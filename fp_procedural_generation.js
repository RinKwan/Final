import * as THREE from "./js/lib/glmatrix/three.js"

class ProcGeneration {

    constructor(seed=0) {
        this.height = 3;
        this.width = 3;
        this.seed = seed;
        console.log("SEED:", seed);

        // Initialize the permutation table and gradient vectors
        this.perm = [];
        this.grad3 = [
            [1, 1, 0], [ -1, 1, 0], [ 1, -1, 0], [ -1, -1, 0]
        ];
        
        // Generate and duplicate the permutation table
        for (let i = 0; i < 256; i++) {
            this.perm[i] = Math.floor(Math.random() * 256);
        }
        this.perm = this.perm.concat(this.perm);  // Duplicate the permutation array
    }


    // Perlin Noise function
    perlinNoise(x, y) {
        // Grid cell coordinates
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Relative position within the cell
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Fade curves
        const u = THREE.fade(x);
        const v = THREE.fade(y);

        // Hash coordinates of the square's corners
        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;

        // Interpolate between corners
        return THREE.lerp(v,
            THREE.lerp(u,
                THREE.grad(this.perm[A], x, y),
                THREE.grad(this.perm[B], x - 1, y)
            ),
            THREE.lerp(u,
                THREE.grad(this.perm[A + 1], x, y - 1),
                THREE.grad(this.perm[B + 1], x - 1, y - 1)
            )
        );
    }

    // create map for terrain generation
    // value is a 50x50 matrix
    mapGeneration() {

        let value = [];   
        for (let y = 0; y < this.height; y++) {
            value[y] = [];
            for (let x = 0; x < this.width; x++) {      
                // skip middle lane
                if (y >= 20 && y <= 30) {
                    value[y][x] = null;
                    continue;
                }

                let nx = (x + this.seed)/this.width - 0.5, ny = (y + this.seed)/this.height - 0.5; // offset coordinates with seed
                let noise_result = THREE.normalize(this.perlinNoise(nx, ny));

                // determine model type
                let model_type;
                if (noise_result < 0.5) model_type = 'grass';
                else if (noise_result < 0.9) model_type = 'rock';
                else if (noise_result <= 1.0) model_type = 'tree';
                else console.log("Incorrect noise_result: ", noise_result);

                value[y][x] = model_type;

            }
        }

        return value;
    }
}

export default ProcGeneration;