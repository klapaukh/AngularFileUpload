/**
 * Description: A THREE loader for GMESH ASCII / Binary files for BEMPP.
 *
 * Supports both binary and ASCII encoded files, with automatic detection of type.
 *
 * The loader returns a non-indexed buffer geometry.
 *
 * Limitations:
 *  Limited support for shape types
 *
 * Usage:
 *  var loader = new GmeshLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 */


import {
    DefaultLoadingManager, BufferGeometry,
    BufferAttribute, Vector3, TextDecoder, LoadingManager
} from 'three';

const GMESH_VERSION = '2.2';

const GMESH_NODES_TO_READ = {
    1: 2,
    2: 3,
    3: 4,
    4: 4,
    5: 8,
    6: 6,
    7: 5,
    8: 3,
    9: 6,
    10: 9,
    11: 10,
    12: 27,
    13: 18,
    14: 14,
    15: 1,
    16: 8,
    17: 20,
    18: 15,
    19: 13,
    20: 9,
    21: 10,
    22: 12,
    23: 15,
    24: 15,
    25: 21,
    26: 4,
    27: 5,
    28: 6,
    29: 20,
    30: 35,
    31: 56,
    92: 65,
    93: 125
};

enum FILE_TYPES {
    ASCII = 0,
    BINARY = 1
}

enum ENDIANNESS {
    NONE = 0,
    BIG_ENDIAN = 1,
    LITTLE_ENDIAN = 2
}
interface GmeshHeader {
    /**
     * Version of the Gmesh format.
     * Must be 2.2
     */
    version_number: string;

    /**
     * Is this file ASCII or Binary
     */
    ASCII: boolean;

    /**
     * Data size of the floating point values.
     * They are always 8 byte doubles in the current version.
     */
    data_size: number; // Always 8

    endianess: ENDIANNESS;
}

interface HeaderBlock {
    header: GmeshHeader;
    rest: string;
}

export class GmeshException {

    message: string;
    name: string;

    constructor(message: string) {
        this.message = message;
        this.name = 'GmeshException';
    }
}

// tslint:disable:no-bitwise
export class GmeshLoader {

    private manager: LoadingManager;

    constructor(manager?: LoadingManager) {
        this.manager = (manager !== undefined) ? manager : DefaultLoadingManager;
    }

    public load(url: File, onLoad: (s: BufferGeometry) => void,
                onProgress?: (r: ProgressEvent) => void, onError?: (e: ErrorEvent) => void) {
        const self: GmeshLoader = this;
        const loader: FileReader = new FileReader();

        loader.onload = (function (event: Event) {
            onLoad(self.parse((event.target as any).result));
        });
        loader.onprogress = onProgress;
        loader.onerror = onError;
        loader.readAsArrayBuffer(url);
    }

    public parse(data: ArrayBuffer): BufferGeometry {
        console.log('Starting parsing');
        const sData = this.ensureString(data);

        const headerBlock = this.getHeader(sData);

        if (headerBlock.header.ASCII) {
            const sections = this.splitSections(headerBlock.rest);
            const namedSections = this.processNames(sections);
            return this.parseASCII(namedSections);
        }

        return this.parseBinary(headerBlock.header, data);
    }

    private splitSections(blob: string): string[] {
        blob = blob.trim();

        const sections: string[] = [];
        while (blob !== '') {
            const sectionSeparator = /^\$([a-z-]+)\s*\n(.|\n)*\$End\1\s*$/mgi;
            const results = sectionSeparator.exec(blob);
            if (results === null || results['index'] !== 0) {
                throw new GmeshException('Found unknown text between sections: ' +
                    blob.substring(0, results === null ? undefined : results['index']));
            }
            const output = results[0];
            sections.push(output);
            blob = blob.substring(output.length).trim();
        }

        return sections;
    }

    private processNames(sections: string[]): { [key: string]: string } {
        const block = {};
        sections.forEach((s: string) => {
            const idx = s.search(/\s+/g);
            if (idx < 0) {
                throw new GmeshException(`Section doesn't have a name: ` + s);
            }
            const name = s.substring(1, idx); // Skip the $ symbol
            const endIdx = s.indexOf('$End' + name);
            if (endIdx < 0) {
                throw new GmeshException(`Section doesn't have an end: ` + endIdx);
            }
            block[name] = s.substring(idx + 1, endIdx).trim();
        });
        return block;
    }

    private getHeader(blob: string): HeaderBlock {
        blob = blob.trim();

        const headerSeparator = /^\$MeshFormat\s*\n(.|\n)*\$EndMeshFormat\s*$/mgi;
        const results = headerSeparator.exec(blob);
        if (results === null || results['index'] !== 0) {
            throw new GmeshException('Did not find header in msh file!');
        }
        const headerBlock = results[0];
        blob = blob.substring(headerBlock.length).trim();

        const headerData = headerBlock.replace(/\$(End)?MeshFormat\s*/g, '').trim().split(/\s+/mg);

        if (headerData.length !== 3 && headerData.length !== 4) {
            throw new GmeshException('Header must contain exactly three or four elements, but is: ' + headerData);
        }
        if (headerData[0] !== GMESH_VERSION) {
            throw new GmeshException('Only GMESH version ' + GMESH_VERSION + ' supported, but file is ' + headerData[0]);
        }
        const ascii: number = parseInt(headerData[1], 10);
        if (ascii !== 1 && ascii !== 0 ) {
            throw new GmeshException('File type must be either 0 or 1, but is ' + ascii);
        }
        const data_size = +(headerData[2]);
        if (data_size !== 8) {
            throw new GmeshException('Data size must be 8 but is ' + data_size);
        }

        let endian = ENDIANNESS.NONE;
        if (ascii === 1) {
            if (headerData[3][0] === '\u0001') {
                endian = ENDIANNESS.LITTLE_ENDIAN;
            } else {
                endian = ENDIANNESS.BIG_ENDIAN;
            }
        }
        return {
            rest: blob,
            header: {
                version_number: headerData[0],
                ASCII: (ascii === 0),
                data_size: data_size,
                endianess: endian
            }
        };
    }

    private parseBinary(header: GmeshHeader, data: ArrayBuffer): BufferGeometry {

        const reader = new DataView(data);

        // First lets get the Nodes. So we can do something with them
        let nodesDataStartIdx = this.getEndIndexOfHeader(reader, '$Nodes');

        if (nodesDataStartIdx < 0 ) {
            throw new GmeshException('Did not find nodes start in msh file!');
        }
        console.log('Nodes block starts at: ' + nodesDataStartIdx);

        // Second line is the count of nodes
        let numResult = this.readInteger(reader, nodesDataStartIdx);
        const nNodes = numResult.value;

        // Shift offset to after number
        nodesDataStartIdx = numResult.index;
        console.log('Preparing to read ' + nNodes + ' nodes from ' + nodesDataStartIdx);

        const vertices = [];
        const vertexMap = {};
        const sizeNodeBlock = 4 + 3 * header.data_size;
        for (let index = 0; index < nNodes; index++) {
            const nodeId = reader.getUint32(nodesDataStartIdx + sizeNodeBlock * index, header.endianess === ENDIANNESS.LITTLE_ENDIAN);

            vertexMap[nodeId] = index;

            for (let i = 0; i < 3 ; i++) {
                vertices.push(reader.getFloat64(nodesDataStartIdx + sizeNodeBlock * index + 4 + i * header.data_size,
                                                header.endianess === ENDIANNESS.LITTLE_ENDIAN));
            }
        }

        // First lets get the Elements. So we can do something with them
        const elementsStartDataIdx = this.getEndIndexOfHeader(reader, '$Elements', nodesDataStartIdx + nNodes * sizeNodeBlock);

        if (elementsStartDataIdx === null) {
            throw new Error('Did not find $Elements in msh file!');
        }

        numResult = this.readInteger(reader, elementsStartDataIdx);
        // First line is the elements header
        // Second line is the count of elements
        // Rest is binary content

        const nElements = numResult.value;

        console.log('Preparing to read ' + nElements + ' elements from: ' + numResult.index);

        const faces = [];
        let readSoFar = numResult.index;
        for (let index = 0; index < nElements;) {
            const elementType = reader.getUint32(readSoFar, header.endianess === ENDIANNESS.LITTLE_ENDIAN);
            const followElements = reader.getUint32(readSoFar + 4, header.endianess === ENDIANNESS.LITTLE_ENDIAN);
            const numTags = reader.getUint32(readSoFar + 8, header.endianess === ENDIANNESS.LITTLE_ENDIAN);

            const elementSize = GMESH_NODES_TO_READ[elementType];
            readSoFar += 12;
            for (let i = 0; i < followElements ; i++) {
                const elementNumber  = reader.getUint32(readSoFar, header.endianess === ENDIANNESS.LITTLE_ENDIAN);
                readSoFar += 4;
                for (let t = 0; t < numTags; t++) {
                    // Read in and drop all the tags
                    reader.getUint32(readSoFar, header.endianess === ENDIANNESS.LITTLE_ENDIAN);
                    readSoFar += 4;
                }
                // Now read in the actual nodes
                for (let f = 0; f < elementSize; f++) {
                    const face = reader.getUint32(readSoFar, header.endianess === ENDIANNESS.LITTLE_ENDIAN);
                    readSoFar += 4;
                    if (elementType === 2) {
                        faces.push(vertexMap[face]);
                    }
                }
                // We read in a face, so count it
                index++;
            }
        }

        const geometry: BufferGeometry = new BufferGeometry();
        geometry.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new BufferAttribute(new Uint32Array(faces), 1));
        geometry.computeVertexNormals();

        return geometry;

    }

    private parseASCII(data: { [key: string]: string }): BufferGeometry {

        const geometry: BufferGeometry = new BufferGeometry();

        let nodeData = data.Nodes.split(/\s+/mig);

        const vertices: number[] = [];
        const vertexMap = {};

        const numNodes = parseInt(nodeData.shift(), 10);

        let mappedId = 0;
        for (let num = 0; num < numNodes; num++) {
            const nodeNumber = parseInt(nodeData.shift(), 10);

            vertexMap[nodeNumber] = mappedId++;

            vertices.push(parseFloat(nodeData.shift()));
            vertices.push(parseFloat(nodeData.shift()));
            vertices.push(parseFloat(nodeData.shift()));
        }

        nodeData = undefined;
        const faceData = data.Elements.split(/\s+/mig);
        const faces: number[] = [];

        const numElements = parseInt(faceData.shift(), 10);

        for (let num = 0; num < numElements; num++) {
            const elemNumber = parseInt(faceData.shift(), 10);
            const elemType = parseInt(faceData.shift(), 10);
            const numTags = parseInt(faceData.shift(), 10);

            // Skip over tags
            for (let i = 0; i < numTags; i++) { faceData.shift(); }

            let toSkip = GMESH_NODES_TO_READ[elemType];
            if (elemType === 2) {
                toSkip = 0;
                // This is a triangle, actually read it.
                for (let i = 0; i < 3; i++) {
                    faces.push(vertexMap[parseInt(faceData.shift(), 10)]);
                }

            } else if (toSkip === undefined) {
                throw new Error('Found a face of unknown type (aborting): ' + elemType +
                    '. Face ' + num + ' out of ' + numElements);
            }

            // Skip not understood elements
            if ( toSkip !== 0 ) {
                console.log('Line not supported - skipped elem type ' + elemType);
                for (let i = 0; i < toSkip; i++) {
                    faceData.shift();
                }
            }
        }

        geometry.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new BufferAttribute(new Uint32Array(faces), 1));
        geometry.computeVertexNormals();

        console.log('Loaded geometry with ' + numElements + ' face and ' + numNodes + ' points');

        return geometry;

    }

    private ensureString(buf: ArrayBuffer): string {
        if (typeof buf !== 'string') {
            const array_buffer = new Uint8Array(buf);
            if ((window as any).TextDecoder !== undefined) {
                return new (window as any).TextDecoder().decode(array_buffer);
            }

            let str = '';

            for (let i = 0, il = buf.byteLength; i < il; i++) {
                str += String.fromCharCode(array_buffer[i]); // implicitly assumes little-endian
            }

            return str;
        } else {
            return buf;
        }

    }

    private ensureBinary(buf) {

        if (typeof buf === 'string') {
            const buffer = new ArrayBuffer(buf.length * 2);
            const array_buffer = new Uint16Array(buffer);
            for (let i = 0; i < buf.length; i++) {
                array_buffer[i] = buf.charCodeAt(i); // implicitly assumes little-endian
            }
            return array_buffer.buffer || array_buffer;
        } else {
            return buf;
        }
    }

    private getEndIndexOfHeader(reader: DataView, expr: string, start = 0): number {
        let index = -1;

        outer: for (let readerIndex = start; readerIndex < reader.byteLength; readerIndex ++) {
            for (let exprIndex = 0; exprIndex < expr.length; exprIndex++) {
                const rValue = reader.getUint8(readerIndex + exprIndex);
                const eValue = expr.charCodeAt(exprIndex);
                if (rValue !== eValue) {
                    continue outer;
                }
            }
            index = readerIndex + expr.length;
            let char = reader.getUint8(index);
            // TODO: Fix this can read past the end of the line
            while (this.isWhiteSpace(char)) {
                index++;
                char = reader.getUint8(index);
            }
            return index;
        }

        return index;
    }

    private isWhiteSpace(char: number): boolean {
        switch (char) {
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 20:
                return true;
            default:
                return false;
        }
    }

    private isDigit(char: number): boolean {
        return char >= 48 && char <= 57;
    }

    private readInteger(reader: DataView, offset: number): { value: number, index: number} {
        const number: number[] = [];
        let idx = offset;
        let char = reader.getUint8(idx);
        while (this.isWhiteSpace(char)) {
            idx++;
            char = reader.getUint8(idx);
        }
        while (this.isDigit(char)) {
            number.push(char);
            idx ++;
            char = reader.getUint8(idx);
        }
        // TODO: Fix this can read past the end of the line
        while (this.isWhiteSpace(char)) {
            idx++;
            char = reader.getUint8(idx);
        }
        return {
            value: parseInt(String.fromCharCode(...number), 10),
            index: idx
        };
    }
}
