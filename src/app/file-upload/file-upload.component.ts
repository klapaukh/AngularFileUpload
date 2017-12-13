import { Component, ContentChild, AfterContentInit, Input, ViewChild, ElementRef } from '@angular/core';
import { PreviewComponent } from '../preview/preview.component';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css']
})
export class FileUploadComponent implements AfterContentInit {
    @ContentChild(PreviewComponent) child: PreviewComponent;
    @ViewChild('upload') input: ElementRef;
    @Input() multiple: boolean;

    private files: FileList;

    constructor() {
        this.multiple = false;
        this.files = undefined;
    }

    public ngAfterContentInit(): void {
        if (this.child === undefined) {
            console.warn('Warning, no preview enabled');
        }
    }

    public textChanged(value): void {
        this.files = value.target.files;

        this.setPreview();
    }

    public setPreview() {
        if (this.child !== undefined && this.files.length === 1) {
            this.child.display = this.files[0].name;
            this.child.ngOnChanges(); // Dynamic changes don't trigger this method
        }
        // No else as you cannot preview multiple files.
    }

    public handleFileSelect(evt: DragEvent) {
        evt.stopPropagation();
        evt.preventDefault();

        this.files = evt.dataTransfer.files;

        const inputBox: HTMLInputElement = this.input.nativeElement;
        inputBox.value = null;
        this.setPreview();
      }

    public handleDragOver(evt: DragEvent) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
      }
}
