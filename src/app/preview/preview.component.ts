import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-preview',
  templateUrl: './preview.component.html',
  styleUrls: ['./preview.component.css']
})
export class PreviewComponent implements OnChanges {
    @Input('display') display: string;

    constructor() {
        this.display = undefined;
    }

    ngOnChanges(): void {
        console.log('Ch... Ch.. Changes!');
        console.log(this.display);
    }
}
