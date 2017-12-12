import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.css']
})
export class PreviewComponent {
    @Input('display') display: string;

    constructor() {
        this.display = 'test';
    }
}
