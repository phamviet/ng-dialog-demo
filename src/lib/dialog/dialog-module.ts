/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {OverlayModule} from '@angular/cdk/overlay';
import {PortalModule} from '@angular/cdk/portal';
import {A11yModule} from '@angular/cdk/a11y';
import {Dialog, DIALOG_SCROLL_STRATEGY_PROVIDER} from './dialog';
import {DialogContainer} from './dialog-container';
import {
  DialogClose,
  DialogTitle,
  DialogContent,
  DialogActions
} from './dialog-content-directives';


@NgModule({
  imports: [
    CommonModule,
    OverlayModule,
    PortalModule,
    A11yModule,
  ],
  exports: [
    DialogContainer,
    DialogClose,
    DialogTitle,
    DialogContent,
    DialogActions
  ],
  declarations: [
    DialogContainer,
    DialogClose,
    DialogTitle,
    DialogContent,
    DialogActions
  ],
  providers: [
    Dialog,
    DIALOG_SCROLL_STRATEGY_PROVIDER,
  ],
  entryComponents: [DialogContainer],
})
export class MatDialogModule {
}
