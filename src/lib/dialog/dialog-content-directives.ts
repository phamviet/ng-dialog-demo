/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive, Input, OnChanges, OnInit, Optional, SimpleChanges} from '@angular/core';
import {DialogRef} from './dialog-ref';
import {DialogContainer} from './dialog-container';

/** Counter used to generate unique IDs for dialog elements. */
let dialogElementUid = 0;

/**
 * Button that will close the current dialog.
 */
@Directive({
  selector: `button[dialog-close], button[dialogClose]`,
  exportAs: 'dialogClose',
  host: {
    '(click)': 'dialogRef.close(dialogResult)',
    '[attr.aria-label]': 'ariaLabel',
    'type': 'button', // Prevents accidental form submits.
  }
})
export class DialogClose implements OnChanges {
  /** Screenreader label for the button. */
  @Input('aria-label') ariaLabel: string = 'Close dialog';

  /** Dialog close input. */
  @Input('dialog-close') dialogResult: any;

  @Input('dialogClose') _dialogClose: any;

  constructor(public dialogRef: DialogRef<any>) { }

  ngOnChanges(changes: SimpleChanges) {
    const proxiedChange = changes._dialogClose || changes._dialogCloseResult;

    if (proxiedChange) {
      this.dialogResult = proxiedChange.currentValue;
    }
  }
}

/**
 * Title of a dialog element. Stays fixed to the top of the dialog when scrolling.
 */
@Directive({
  selector: '[dialog-title], [dialogTitle]',
  exportAs: 'dialogTitle',
  host: {
    'class': 'dialog-title',
    '[id]': 'id',
  },
})
export class DialogTitle implements OnInit {
  @Input() id = `dialog-title-${dialogElementUid++}`;

  constructor(@Optional() private _container: DialogContainer) { }

  ngOnInit() {
    if (this._container && !this._container._ariaLabelledBy) {
      Promise.resolve().then(() => this._container._ariaLabelledBy = this.id);
    }
  }
}


/**
 * Scrollable content container of a dialog.
 */
@Directive({
  selector: `[dialog-content], dialog-content, [dialogContent]`,
  host: {'class': 'dialog-content'}
})
export class DialogContent { }


/**
 * Container for the bottom action buttons in a dialog.
 * Stays fixed to the bottom when scrolling.
 */
@Directive({
  selector: `[dialog-actions], dialog-actions, [dialogActions]`,
  host: {'class': 'dialog-actions'}
})
export class DialogActions { }
