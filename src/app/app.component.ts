import { Component } from '@angular/core';
import { Dialog } from '../lib/dialog';
import { HelloComponent } from './hello/hello.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app';

  constructor(private dialog: Dialog) {

  }

  sayHello() {
    this.dialog.open(HelloComponent, { width: '500px' });
  }
}
