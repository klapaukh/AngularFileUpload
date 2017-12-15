import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app';

  public handleFiles(files: FileList) {
    console.log('Got Files:');
    for (let i = 0; i < files.length; i++) {
      console.log('\t' + files[i].name);
    }
  }
}
