import { Component, ContentChild, AfterContentInit } from '@angular/core';
import { PreviewComponent } from '../preview/preview.component';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css']
})
export class FileUploadComponent implements AfterContentInit {
    @ContentChild(PreviewComponent) child: PreviewComponent;


    public ngAfterContentInit(): void {
        if (this.child === undefined) {
            console.error('Child is undefined!!!');
        }
        this.child.display = 'Cool Stuff!';
    }

    public textChanged(value): void {
        if (this.child !== undefined) {
            this.child.display = value.target.value;
        }
    }
}
