import {
    Component, Input, OnChanges, ViewChild, ElementRef,
    OnInit, SimpleChanges
} from '@angular/core';

import {
    Scene, PerspectiveCamera, WebGLRenderer, Mesh, Color,
    MeshPhongMaterial, PointLight, AmbientLight, Geometry,
    BoxGeometry, FrontSide
} from 'three';

import { TrackballControls } from './TrackballControls';
import { GmeshLoader } from './GmeshLoader';

@Component({
    selector: 'app-preview',
    templateUrl: './preview.component.html',
    styleUrls: ['./preview.component.css']
})
export class PreviewComponent implements OnInit {
    @ViewChild('modelDisplay') modelDiv: ElementRef;
    @ViewChild('modelCanvas') modelCanvas: ElementRef;

    private display: File;

    // Rendering fields
    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;
    private mesh: Mesh;

    constructor() {
        this.display = undefined;
    }

    public ngOnInit(): void {
        // Set up a render window
        this.renderer = new WebGLRenderer({ canvas: this.modelCanvas.nativeElement });
        this.modelDiv.nativeElement.appendChild(this.renderer.domElement);

        this.scene = new Scene();
        // this.scene.background = new Color(0x000000);

        const screenRatio = this.renderer.domElement.offsetWidth / this.renderer.domElement.offsetHeight;
        console.log('Setting screen ratio to ' + screenRatio + ' width: ' + this.renderer.domElement.offsetWidth);
        this.camera = new PerspectiveCamera(75, screenRatio, 0.1, 1000);

        const lights: PointLight[] = [];
        lights[0] = new PointLight(0xffffff, 1, 0);
        lights[1] = new PointLight(0xffffff, 1, 0);
        lights[2] = new PointLight(0xffffff, 1, 0);

        lights[0].position.set(0, 200, 0);
        lights[1].position.set(100, 200, 100);
        lights[2].position.set(- 100, - 200, - 100);

        this.scene.add(lights[0]);
        this.scene.add(lights[1]);
        this.scene.add(lights[2]);

        const ambLight: AmbientLight = new AmbientLight(0xffffff);
        this.scene.add(ambLight);

        this.camera.position.x = -3;

        this.generateMesh();

        this.render();

        const controls = new TrackballControls(this.camera, this.renderer.domElement, this);
    }

    public render(): void {
        if (this.renderer === undefined) {
            return;
        }
        this.renderer.render(this.scene, this.camera);
    }

    public changeDisplay(newDisplay: File) {
        this.clearScene();
        this.display = newDisplay;
        this.generateMesh();
    }

    private clearScene(): void {
        if (this.mesh === undefined) {
            return;
        }
        this.scene.remove(this.mesh);
        this.mesh = undefined;
    }

    private generateMesh(): void {
        if (this.display === undefined) {
            return;
        }
        const loader = new GmeshLoader();
        const self = this;
        loader.load(this.display, function (geometry) {
            geometry.center();
            // Should this normalise the size as well?
            const material = new MeshPhongMaterial({ color: 0x0000ff, side: FrontSide });
            self.mesh = new Mesh(geometry, material);
            self.scene.add(self.mesh);
            self.render();
        });
    }

}
