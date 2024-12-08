'use strict'

import { hex2rgb, deg2rad, loadExternalFile } from '../utils/utils.js'
import Box from './box3d.js'
import Input from '../input/input.js'
import * as mat4 from '../lib/glmatrix/mat4.js'
import * as vec3 from '../lib/glmatrix/vec3.js'
import * as quat from '../lib/glmatrix/quat.js'
import ProcGeneration from '../../fp_procedural_generation.js'

import { OBJLoader } from '../../assignment3.objloader.js'
import { Scene, SceneNode } from './scene.js'

import App from './app.js'


/**
 * @Class
 * WebGlApp that will call basic GL functions, manage a list of shapes, and take care of rendering them
 * 
 * This class will use the Shapes that you have implemented to store and render them
 */
class WebGlApp {
    /**
     * Initializes the app with a box, and the model, view, and projection matrices
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Map<String,Shader>} shader The shaders to be used to draw the object
     * @param {AppState} app_state The state of the UI
     */
    constructor(gl, shaders, app_state) {
        // Set GL flags
        this.setGlFlags(gl)

        // Store the shader(s)
        this.shaders = shaders // Collection of all shaders
        this.box_shader = this.shaders[0]
        this.light_shader = this.shaders[this.shaders.length - 1]
        this.active_shader = 1

        // Create a box instance and create a variable to track its rotation
        this.box = new Box(gl, this.box_shader)
        this.animation_step = 0

        // Create a procedural generation instance for terrain
        let seed = 42;
        this.proc_gen = new ProcGeneration(seed);

        // Declare a variable to hold a Scene
        // Scene files can be loaded through the UI (see below)
        this.scene = null

        // Bind a callback to the file dialog in the UI that loads a scene file
        app_state.onOpen3DScene((filename) => {
            let scene_config = JSON.parse(loadExternalFile(`./scenes/${filename}`))
            this.scene = new Scene(scene_config, gl, this.shaders[this.active_shader], this.light_shader)
            return this.scene
        })

        // Create the view matrix
        this.eye = [2.0, 0.5, -2.0]
        this.center = [0, 0, 0]

        this.forward = null
        this.right = null
        this.up = null
        // Forward, Right, and Up are initialized based on Eye and Center
        this.updateViewSpaceVectors()
        this.view = mat4.lookAt(mat4.create(), this.eye, this.center, this.up)

        // Create the projection matrix
        this.fovy = 60
        this.aspect = 16 / 9
        this.near = 0.001
        this.far = 1000.0
        this.projection = mat4.perspective(mat4.create(), deg2rad(this.fovy), this.aspect, this.near, this.far)

        // Use the shader's setUniform4x4f function to pass the matrices
        for (let shader of this.shaders) {
            shader.use()
            shader.setUniform3f('u_eye', this.eye);
            shader.setUniform4x4f('u_v', this.view)
            shader.setUniform4x4f('u_p', this.projection)
            shader.unuse()
        }

        //---
        this.gl = gl;
        this.N = 0;
        let depthFramebuffer1, depthTexture1 = this.prepareFrameBuffer();
        let depthFramebuffer2, depthTexture2 = this.prepareFrameBuffer();
        this.depthFramebuffers = [depthFramebuffer1, depthFramebuffer2]
        this.depthTextures = [depthTexture1, depthTexture2]
    }

    /**
     * Sets up GL flags
     * In this assignment we are drawing 3D data, so we need to enable the flag 
     * for depth testing. This will prevent from geometry that is occluded by other 
     * geometry from 'shining through' (i.e. being wrongly drawn on top of closer geomentry)
     * 
     * Look into gl.enable() and gl.DEPTH_TEST to learn about this topic
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     */
    setGlFlags(gl) {

        // Enable depth test
        gl.enable(gl.DEPTH_TEST)

    }

    /**
     * Sets the viewport of the canvas to fill the whole available space so we draw to the whole canvas
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Number} width 
     * @param {Number} height 
     */
    setViewport(gl, width, height) {
        gl.viewport(0, 0, width, height)
    }

    /**
     * Clears the canvas color
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     */
    clearCanvas(gl) {
        gl.clearColor(...hex2rgb('#000000'), 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    /**
     * Updates components of this app
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {AppState} app_state The state of the UI
     * @param {Number} delta_time The time in fractional seconds since the last frame
     */
    update(gl, app_state, delta_time) {
        // Shader
        if (this.scene != null) {
            let old_active_shader = this.active_shader
            switch (app_state.getState('Shading')) {
                case 'Phong':
                    this.active_shader = 1
                    break
                case 'Textured':
                    this.active_shader = 2
                    break
            }
            // console.log(this.active_shader)
            if (old_active_shader != this.active_shader) {
                this.scene.resetLights(this.shaders[this.active_shader])
                for (let node of this.scene.getNodes()) {
                    if (node.type == 'model')
                        node.setShader(gl, this.shaders[this.active_shader])
                    if (node.type == 'light')
                        node.setTargetShader(this.shaders[this.active_shader])
                }
            }
        }

        // Shader Debug
        switch (app_state.getState('Shading Debug')) {
            case 'Normals':
                this.shaders[this.active_shader].use()
                this.shaders[this.active_shader].setUniform1i('u_show_normals', 1)
                this.shaders[this.active_shader].unuse()
                break
            default:
                this.shaders[this.active_shader].use()
                this.shaders[this.active_shader].setUniform1i('u_show_normals', 0)
                this.shaders[this.active_shader].unuse()
                break
        }

        // Control
        switch (app_state.getState('Control')) {
            case 'Camera':
                this.updateCamera(delta_time)
                break
            case 'Scene Node':
                // Only do this if a scene is loaded
                if (this.scene == null)
                    break

                // Get the currently selected scene node from the UI
                let scene_node = this.scene.getNode(app_state.getState('Select Scene Node'))
                this.updateSceneNode(scene_node, delta_time)
                break
        }

        // Procedural Geneartion
        let old_seed = -100;
        let new_seed = app_state.getState('Procedural Generation');
        if (new_seed != old_seed) {
            // console.log(new_seed);
            // console.log(old_seed);
            if (this.scene != null) {
                this.proc_gen.seed = new_seed;
                const procMap = this.proc_gen.mapGeneration();
                this.scene.generateGridObjects(procMap, gl, this.shaders[this.active_shader]);
            }
            old_seed = new_seed;
        }


    }

    /**
     * Update the Forward, Right, and Up vector according to changes in the 
     * camera position (Eye) or the center of focus (Center)
     */
    updateViewSpaceVectors() {
        this.forward = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), this.eye, this.center))
        this.right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), [0, 1, 0], this.forward))
        this.up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.forward, this.right))
    }

    /**
     * Update the camera view based on user input and the arcball viewing model
     * 
     * Supports the following interactions:
     * 1) Left Mouse Button - Rotate the view's center
     * 2) Middle Mouse Button or Space+Left Mouse Button - Pan the view relative view-space
     * 3) Right Mouse Button - Zoom towards or away from the view's center
     * 
     * @param {Number} delta_time The time in seconds since the last frame (floating point number)
     */
    updateCamera(delta_time) {
        let view_dirty = false

        // Control - Zoom
        if (Input.isMouseDown(2)) {
            // Scale camera position
            let translation = vec3.scale(vec3.create(), this.forward, -Input.getMouseDy() * delta_time)
            this.eye = vec3.add(vec3.create(), this.eye, translation)

            // Set dirty flag to trigger view matrix updates
            view_dirty = true
        }

        // Control - Rotate
        if (Input.isMouseDown(0) && !Input.isKeyDown(' ')) {
            // Rotate around xz plane around y
            this.eye = vec3.rotateY(vec3.create(), this.eye, this.center, deg2rad(-10 * Input.getMouseDx() * delta_time))

            // Rotate around view-aligned rotation axis
            let rotation = mat4.fromRotation(mat4.create(), deg2rad(-10 * Input.getMouseDy() * delta_time), this.right)
            this.eye = vec3.transformMat4(vec3.create(), this.eye, rotation)

            // Set dirty flag to trigger view matrix updates
            view_dirty = true
        }

        // Control - Pan
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' '))) {
            // Create translation on two view-aligned axes
            let translation = vec3.add(vec3.create(),
                vec3.scale(vec3.create(), this.right, -0.75 * Input.getMouseDx() * delta_time),
                vec3.scale(vec3.create(), this.up, 0.75 * Input.getMouseDy() * delta_time)
            )

            // Translate both eye and center in parallel
            this.eye = vec3.add(vec3.create(), this.eye, translation)
            this.center = vec3.add(vec3.create(), this.center, translation)

            view_dirty = true
        }

        // Update view matrix if needed
        if (view_dirty) {
            // Update Forward, Right, and Up vectors
            this.updateViewSpaceVectors()

            this.view = mat4.lookAt(mat4.create(), this.eye, this.center, this.up)

            for (let shader of this.shaders) {
                shader.use()
                shader.setUniform3f('u_eye', this.eye)
                shader.setUniform4x4f('u_v', this.view)
                shader.unuse()
            }
        }
    }

    /**
     * Update a SceneNode's local transformation
     * 
     * Supports the following interactions:
     * 1) Left Mouse Button - Rotate the node relative to the view along the Up and Right axes
     * 2) Middle Mouse Button or Space+Left Mouse Button - Translate the node relative to the view along the Up and Right axes
     * 3) Right Mouse Button - Scales the node around it's local center
     * 
     * @param {SceneNode} node The SceneNode to manipulate
     * @param {Number} delta_time The time in seconds since the last frame (floating point number)
     */
    updateSceneNode(node, delta_time) {
        let node_dirty = false

        let translation = mat4.create()
        let rotation = mat4.create()
        let scale = mat4.create()

        // Control - Scale
        if (Input.isMouseDown(2)) {
            let factor = 1.0 + Input.getMouseDy() * delta_time
            scale = mat4.fromScaling(mat4.create(), [factor, factor, factor])

            node_dirty = true
        }

        // Control - Rotate
        if (Input.isMouseDown(0) && !Input.isKeyDown(' ')) {

            let rotation_up = mat4.fromRotation(mat4.create(), deg2rad(10 * Input.getMouseDx() * delta_time), this.up)
            let rotation_right = mat4.fromRotation(mat4.create(), deg2rad(10 * Input.getMouseDy() * delta_time), this.right)

            rotation = mat4.multiply(mat4.create(), rotation_right, rotation_up)

            node_dirty = true
        }

        // Control - Translate
        if (Input.isMouseDown(1) || (Input.isMouseDown(0) && Input.isKeyDown(' '))) {

            translation = mat4.fromTranslation(mat4.create(),
                vec3.add(vec3.create(),
                    vec3.scale(vec3.create(), this.right, 0.75 * Input.getMouseDx() * delta_time),
                    vec3.scale(vec3.create(), this.up, -0.75 * Input.getMouseDy() * delta_time)
                ))

            node_dirty = true
        }


        // Update node transformation if needed
        if (node_dirty) {

            // Get the world rotation and scale of the node
            // Construct the inverse transformation of that matrix
            // We isolate the rotation and scale by setting the right column of the matrix to 0,0,0,1
            // If this is the root node, we set both matrices to identity
            let world_rotation_scale = mat4.clone(node.getWorldTransformation())
            let world_rotation_scale_inverse = null
            if (world_rotation_scale != null) {
                world_rotation_scale[12] = 0, world_rotation_scale[13] = 0, world_rotation_scale[14] = 0
                world_rotation_scale_inverse = mat4.invert(mat4.create(), world_rotation_scale)
            } else {
                world_rotation_scale = mat4.create()
                world_rotation_scale_inverse = mat4.create()
            }

            // Get the node's local transformation that we modify
            let transformation = node.getTransformation()

            // It's best to read this block from the bottom up
            // This is the order in which the transformations will take effect
            // Fourth, apply the scaling
            transformation = mat4.multiply(mat4.create(), transformation, scale)
            // Third, remove the full world rotation and scale to turn this back into a local matrix
            transformation = mat4.multiply(mat4.create(), transformation, world_rotation_scale_inverse)
            // Second, apply rotation and translation in world space alignment
            transformation = mat4.multiply(mat4.create(), transformation, translation)
            transformation = mat4.multiply(mat4.create(), transformation, rotation)
            // First, temporarily apply the full world rotation and scale to align the object in world space
            transformation = mat4.multiply(mat4.create(), transformation, world_rotation_scale)

            // Update the node's transformation
            node.setTransformation(transformation)
        }
    }


    /**
     * Main render loop which sets up the active viewport (i.e. the area of the canvas we draw to)
     * clears the canvas with a background color and draws the scene
     * 
     * @param {WebGL2RenderingContext} gl The webgl2 rendering context
     * @param {Number} canvas_width The canvas width. Needed to set the viewport
     * @param {Number} canvas_height The canvas height. Needed to set the viewport
     */
    render(gl, canvas_width, canvas_height) {
        //if (this.N % 2 == 0)
        //    this.render1(gl, canvas_width, canvas_height);
        ////return;
        //else
        //    //*
        //    this.render2(gl, canvas_width, canvas_height);
        //this.N += 1;

        this.render1(gl, canvas_width, canvas_height, 0);
        this.render1(gl, canvas_width, canvas_height, 1);
        this.render2(gl, canvas_width, canvas_height);
    }

    render1(gl, canvas_width, canvas_height, which_ligth) {
        // this.setViewport(gl, 512, 512)
        gl.viewport(0, 0, 512, 512);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFramebuffers[which_ligth]); //---
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
            throw new Error('checkFramebufferStatus error!');

        // this.clearCanvas(gl)
        gl.clearColor(0, 0.2, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // console.log(this.active_shader)
        var current_shader = this.shaders[2]
        current_shader.use()

        //gl.activeTexture(gl.TEXTURE3);
        //gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        //gl.uniform1i(current_shader.getUniformLocation("shadowMap"), 3); //GL_TEXTURE3

        var is_depthLocation = current_shader.getUniformLocation("is_depth");
        if (is_depthLocation == null) throw new Error();
        gl.uniform1i(is_depthLocation, 1);
        current_shader.unuse()

        //this.box.render(gl)
        App.which_ligth = which_ligth;
        if (this.scene) this.scene.render(gl);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null); //---

        gl.activeTexture(gl.TEXTURE10 + which_ligth);
        gl.bindTexture(gl.TEXTURE_2D, this.depthTextures[which_ligth]);
    }

    render2(gl, canvas_width, canvas_height) {

        //##########################################################################################
        var current_shader = this.shaders[2]
        var is_depthLocation = current_shader.getUniformLocation("is_depth");
        if (is_depthLocation == null) throw new Error();

        // this.setViewport(gl, canvas_width, canvas_height)
        gl.viewport(0, 0, canvas_width, canvas_height)
        gl.clearColor(0, 0, 0.2, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // this.clearCanvas(gl)

        current_shader.use()
        gl.uniform1i(is_depthLocation, 0)
        //gl.activeTexture(gl.TEXTURE10 + 0);
        //gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        //gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        var shadowMapLocation0 = current_shader.getUniformLocation("shadowMap0");
        if (shadowMapLocation0 != null) {
            gl.uniform1i(shadowMapLocation0, 10); //GL_TEXTURE10
        }
        var shadowMapLocation1 = current_shader.getUniformLocation("shadowMap1");
        if (shadowMapLocation1 != null) {
            gl.uniform1i(shadowMapLocation1, 11); //GL_TEXTURE11
        }
        current_shader.unuse()

        // Render the box
        // This will use the MVP that was passed to the shader
        this.box.render(gl)

        // Render the scene
        if (this.scene) this.scene.render(gl)
        //*/
    }

    prepareFrameBuffer() {
        var gl = this.gl;
        // Depth Texture
        let depthTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, 512, 512, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null,);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, 512, 512);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // bind unused
        //gl.activeTexture(gl.TEXTURE5);
        //this.unusedTexture = gl.createTexture();
        //gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        ////gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 512, 512, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //gl.bindTexture(gl.TEXTURE_2D, null);
        // attach it to the framebuffer

        let depthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
        //gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.unusedTexture, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('checkFramebufferStatus error!');
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return depthFramebuffer, depthTexture
    }

}

export default WebGlApp
