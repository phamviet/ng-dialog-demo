import {ESCAPE} from '@angular/cdk/keycodes';
import {
  BlockScrollStrategy,
  Overlay,
  OverlayRef,
  OverlayConfig,
  ScrollStrategy,
} from '@angular/cdk/overlay';
import {ComponentPortal, ComponentType, PortalInjector, TemplatePortal} from '@angular/cdk/portal';
import {filter} from 'rxjs/operators/filter';
import {startWith} from 'rxjs/operators/startWith';
import {Location} from '@angular/common';
import {
  ComponentRef,
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  Optional,
  SkipSelf,
  TemplateRef,
} from '@angular/core';
import assignIn from 'lodash.assignin';
import {Directionality} from '@angular/cdk/bidi';
import {Observable} from 'rxjs/Observable';
import {defer} from 'rxjs/observable/defer';
import {Subject} from 'rxjs/Subject';
import {DialogConfig} from './dialog-config';
import {DialogContainer} from './dialog-container';
import {DialogRef} from './dialog-ref';
import {of as observableOf} from 'rxjs/observable/of';


export const DIALOG_DATA = new InjectionToken<any>('DialogData');


/** Injection token that determines the scroll handling while the dialog is open. */
export const DIALOG_SCROLL_STRATEGY =
    new InjectionToken<() => ScrollStrategy>('mat-dialog-scroll-strategy');

/** @docs-private */
export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay):
    () => BlockScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

/** @docs-private */
export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};


/**
 * Service to open Material Design modal dialogs.
 */
@Injectable()
export class Dialog {
  private _openDialogsAtThisLevel: DialogRef<any>[] = [];
  private _afterAllClosedAtThisLevel = new Subject<void>();
  private _afterOpenAtThisLevel = new Subject<DialogRef<any>>();

  /** Keeps track of the currently-open dialogs. */
  get openDialogs(): DialogRef<any>[] {
    return this._parentDialog ? this._parentDialog.openDialogs : this._openDialogsAtThisLevel;
  }

  /** Stream that emits when a dialog has been opened. */
  get afterOpen(): Subject<DialogRef<any>> {
    return this._parentDialog ? this._parentDialog.afterOpen : this._afterOpenAtThisLevel;
  }

  get _afterAllClosed() {
    const parent = this._parentDialog;
    return parent ? parent._afterAllClosed : this._afterAllClosedAtThisLevel;
  }

  /**
   * Stream that emits when all open dialog have finished closing.
   * Will emit on subscribe if there are no open dialogs to begin with.
   */
  afterAllClosed: Observable<void> = defer<void>(() => this.openDialogs.length ?
      this._afterAllClosed :
      this._afterAllClosed.pipe(startWith(undefined)));

  constructor(
      private _overlay: Overlay,
      private _injector: Injector,
      @Optional() location: Location,
      @Inject(DIALOG_SCROLL_STRATEGY) private _scrollStrategy,
      @Optional() @SkipSelf() private _parentDialog: Dialog) {

    // Close all of the dialogs when the user goes forwards/backwards in history or when the
    // location hash changes. Note that this usually doesn't include clicking on links (unless
    // the user is using the `HashLocationStrategy`).
    if (!_parentDialog && location) {
      location.subscribe(() => this.closeAll());
    }
  }

  /**
   * Opens a modal dialog containing the given component.
   * @param componentOrTemplateRef Type of the component to load into the dialog,
   *     or a TemplateRef to instantiate as the dialog content.
   * @param config Extra configuration options.
   * @returns Reference to the newly-opened dialog.
   */
  open<T, D = any>(componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
          config?: DialogConfig<D>): DialogRef<T> {

    const inProgressDialog = this.openDialogs.find(dialog => dialog._isAnimating());

    // If there's a dialog that is in the process of being opened, return it instead.
    if (inProgressDialog) {
      return inProgressDialog;
    }

    config = _applyConfigDefaults(config);

    if (config.id && this.getDialogById(config.id)) {
      throw Error(`Dialog with id "${config.id}" exists already. The dialog id must be unique.`);
    }

    const overlayRef = this._createOverlay(config);
    const dialogContainer = this._attachDialogContainer(overlayRef, config);
    const dialogRef =
        this._attachDialogContent(componentOrTemplateRef, dialogContainer, overlayRef, config);

    this.openDialogs.push(dialogRef);
    dialogRef.afterClosed().subscribe(() => this._removeOpenDialog(dialogRef));
    this.afterOpen.next(dialogRef);

    return dialogRef;
  }

  /**
   * Closes all of the currently-open dialogs.
   */
  closeAll(): void {
    let i = this.openDialogs.length;

    while (i--) {
      // The `_openDialogs` property isn't updated after close until the rxjs subscription
      // runs on the next microtask, in addition to modifying the array as we're going
      // through it. We loop through all of them and call close without assuming that
      // they'll be removed from the list instantaneously.
      this.openDialogs[i].close();
    }
  }

  /**
   * Finds an open dialog by its id.
   * @param id ID to use when looking up the dialog.
   */
  getDialogById(id: string): DialogRef<any> | undefined {
    return this.openDialogs.find(dialog => dialog.id === id);
  }

  /**
   * Creates the overlay into which the dialog will be loaded.
   * @param config The dialog configuration.
   * @returns A promise resolving to the OverlayRef for the created overlay.
   */
  private _createOverlay(config: DialogConfig): OverlayRef {
    const overlayConfig = this._getOverlayConfig(config);
    return this._overlay.create(overlayConfig);
  }

  /**
   * Creates an overlay config from a dialog config.
   * @param dialogConfig The dialog configuration.
   * @returns The overlay configuration.
   */
  private _getOverlayConfig(dialogConfig: DialogConfig): OverlayConfig {
    const state = new OverlayConfig({
      positionStrategy: this._overlay.position().global(),
      scrollStrategy: this._scrollStrategy(),
      panelClass: dialogConfig.panelClass,
      hasBackdrop: dialogConfig.hasBackdrop,
      direction: dialogConfig.direction,
      minWidth: dialogConfig.minWidth,
      minHeight: dialogConfig.minHeight,
      maxWidth: dialogConfig.maxWidth,
      maxHeight: dialogConfig.maxHeight
    });

    if (dialogConfig.backdropClass) {
      state.backdropClass = dialogConfig.backdropClass;
    }

    return state;
  }

  /**
   * Attaches an DialogContainer to a dialog's already-created overlay.
   * @param overlay Reference to the dialog's underlying overlay.
   * @param config The dialog configuration.
   * @returns A promise resolving to a ComponentRef for the attached container.
   */
  private _attachDialogContainer(overlay: OverlayRef, config: DialogConfig): DialogContainer {
    let containerPortal = new ComponentPortal(DialogContainer, config.viewContainerRef);
    let containerRef: ComponentRef<DialogContainer> = overlay.attach(containerPortal);
    containerRef.instance._config = config;

    return containerRef.instance;
  }

  /**
   * Attaches the user-provided component to the already-created DialogContainer.
   * @param componentOrTemplateRef The type of component being loaded into the dialog,
   *     or a TemplateRef to instantiate as the content.
   * @param dialogContainer Reference to the wrapping DialogContainer.
   * @param overlayRef Reference to the overlay in which the dialog resides.
   * @param config The dialog configuration.
   * @returns A promise resolving to the DialogRef that should be returned to the user.
   */
  private _attachDialogContent<T>(
      componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
      dialogContainer: DialogContainer,
      overlayRef: OverlayRef,
      config: DialogConfig): DialogRef<T> {

    // Create a reference to the dialog we're creating in order to give the user a handle
    // to modify and close it.
    const dialogRef = new DialogRef<T>(overlayRef, dialogContainer, config.id);

    // When the dialog backdrop is clicked, we want to close it.
    if (config.hasBackdrop) {
      overlayRef.backdropClick().subscribe(() => {
        if (!dialogRef.disableClose) {
          dialogRef.close();
        }
      });
    }

    // Close when escape keydown event occurs
    overlayRef.keydownEvents().pipe(
      filter(event => event.keyCode === ESCAPE && !dialogRef.disableClose)
    ).subscribe(() => dialogRef.close());

    if (componentOrTemplateRef instanceof TemplateRef) {
      dialogContainer.attachTemplatePortal(
        new TemplatePortal<T>(componentOrTemplateRef, null!,
          <any>{ $implicit: config.data, dialogRef }));
    } else {
      const injector = this._createInjector<T>(config, dialogRef, dialogContainer);
      const contentRef = dialogContainer.attachComponentPortal(
          new ComponentPortal(componentOrTemplateRef, undefined, injector));
      dialogRef.componentInstance = contentRef.instance;
    }

    dialogRef
      .updateSize(config.width, config.height)
      .updatePosition(config.position);

    return dialogRef;
  }

  /**
   * Creates a custom injector to be used inside the dialog. This allows a component loaded inside
   * of a dialog to close itself and, optionally, to return a value.
   * @param config Config object that is used to construct the dialog.
   * @param dialogRef Reference to the dialog.
   * @param container Dialog container element that wraps all of the contents.
   * @returns The custom injector that can be used inside the dialog.
   */
  private _createInjector<T>(
      config: DialogConfig,
      dialogRef: DialogRef<T>,
      dialogContainer: DialogContainer): PortalInjector {

    const userInjector = config && config.viewContainerRef && config.viewContainerRef.injector;
    const injectionTokens = new WeakMap();

    injectionTokens.set(DialogRef, dialogRef);
    // The DialogContainer is injected in the portal as the DialogContainer and the dialog's
    // content are created out of the same ViewContainerRef and as such, are siblings for injector
    // purposes.  To allow the hierarchy that is expected, the DialogContainer is explicitly
    // added to the injection tokens.
    injectionTokens.set(DialogContainer, dialogContainer);
    injectionTokens.set(DIALOG_DATA, config.data);
    injectionTokens.set(Directionality, {
      value: config.direction,
      change: observableOf()
    });

    return new PortalInjector(userInjector || this._injector, injectionTokens);
  }

  /**
   * Removes a dialog from the array of open dialogs.
   * @param dialogRef Dialog to be removed.
   */
  private _removeOpenDialog(dialogRef: DialogRef<any>) {
    const index = this.openDialogs.indexOf(dialogRef);

    if (index > -1) {
      this.openDialogs.splice(index, 1);

      // no open dialogs are left, call next on afterAllClosed Subject
      if (!this.openDialogs.length) {
        this._afterAllClosed.next();
      }
    }
  }
}

/**
 * Applies default options to the dialog config.
 * @param config Config to be modified.
 * @returns The new configuration object.
 */
function _applyConfigDefaults(config?: DialogConfig): DialogConfig {
  return assignIn(new DialogConfig(), config);
}
