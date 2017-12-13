import { Component, ContentChild, AfterContentInit, Input } from '@angular/core';
import { PreviewComponent } from '../preview/preview.component';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css']
})
export class FileUploadComponent implements AfterContentInit {
    @ContentChild(PreviewComponent) child: PreviewComponent;
    @Input() multiple: boolean;

    constructor() {
        this.multiple = false;
    }

    public ngAfterContentInit(): void {
        if (this.child === undefined) {
            console.error('Child is undefined!!!');
        }
    }

    public textChanged(value): void {
        if (this.child === undefined) {
            return;
        }
        const files: File[] = Array.from(value.target.files);
        if (files.length === 1 ) {
            this.child.display = files[0].name;
            this.child.ngOnChanges(); // Dynamic changes don't trigger this method
        }
        // No else as you cannot preview multiple files.
    }
}
