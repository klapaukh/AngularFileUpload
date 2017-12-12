import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { PreviewComponent } from './preview/preview.component';


@NgModule({
  declarations: [
    AppComponent,
    FileUploadComponent,
    PreviewComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
