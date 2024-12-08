'use strict'

import Input from '../input/input.js'

class AppState
{

    constructor( )
    {
        // get list of UI indicators
        this.ui_categories = {
            // 'Shading':
            // {
            //     'Phong': document.getElementById( 'shadingPhong' ),
            //     'Textured': document.getElementById( 'shadingTextured' ),
            // },
            // 'Shading Debug': {
            //     'Normals': document.getElementById( 'shadingDebugNormals' ),
            // },
            'Procedural Generation': {
                'Seed': document.getElementById( 'seedInput' ),
            },
            'Particle Systems': {
                'Wind': document.getElementById( 'windInput' ),
                'Gravity': document.getElementById( 'gravityInput' )
            },
            'Control':
            {
                'Camera': document.getElementById( 'controlCamera' ),
                'Scene Node': document.getElementById( 'controlSceneNode' )
            },
            'Select Scene Node': document.getElementById( 'selectSceneNodeSelect' ),
            '3D Scene': document.getElementById( 'openfileActionInput' )
        }

        // create state dictionary
        this.ui_state = {
            'Shading': '',
            'Procedural Generation': '0',
            'Particle Systems': '',
            'Control': '',
            'Select Scene Node': ''
        }

        // Update UI with default values
        this.updateUI( 'Shading', 'Textured' )
        // this.updateUI( 'Shading Debug', '' )
        this.updateUI( 'Procedural Generation', '' )
        this.updateUI( 'Particle Systems', '' )
        this.updateUI( 'Control', 'Camera' )
        
        // Set asynchronous handlers
        this.ui_categories['Select Scene Node'].onchange = () => {
            this.ui_state['Select Scene Node'] = this.ui_categories['Select Scene Node'].value
        }
        this.onOpen3DSceneCallback = null
        this.ui_categories['3D Scene'].onchange = (evt) => {
            if (this.onOpen3DSceneCallback == null)
                return
            
            let scene = this.onOpen3DSceneCallback(evt.target.files[0].name)
            this.ui_categories['Select Scene Node'].innerHTML = ''
            for (let node of scene.getNodes()) {
                let option = document.createElement('option')
                option.value = node.name
                option.innerHTML = node.name
                this.ui_categories['Select Scene Node'].appendChild(option)
            }
            this.ui_categories['Select Scene Node'].removeAttribute('disabled')
            this.ui_categories['Select Scene Node'].value = this.ui_categories['Select Scene Node'].getElementsByTagName('option')[0].value
            this.ui_state['Select Scene Node'] = this.ui_categories['Select Scene Node'].value
        }
    }

    /**
     * Sets a callback to react to opening a scene file
     * 
     * @param {Function} callback Function that creates a scene and returns it
     */
    onOpen3DScene(callback) {
        this.onOpen3DSceneCallback = callback
    }

    /**
     * Returns the content of a UI state
     * @param {String} name The name of the state to query 
     * @returns {String | null} The state for the ui state name
     */
    getState( name )
    {
        return this.ui_state[name]
    }

    /**
     * Updates the app state by checking the input module for changes in user input
     */
    update( )
    {
        // Shading
        if ( Input.isKeyPressed( 'c' ) ) {
            this.updateUI( 'Shading', 'Phong' )
        } else if ( Input.isKeyPressed( 'v' ) ) {
            this.updateUI( 'Shading', 'Textured' )
        }

        // Shading Debug
        if ( Input.isKeyDown( 'n' ) ) {
            this.updateUI( 'Shading Debug', 'Normals' )
        } else {
            this.updateUI( 'Shading Debug', '' )
        }

        // Transformation
        if ( Input.isKeyDown( 'q' ) ) {
            this.updateUI( 'Control', 'Scene Node')
        } else {
            this.updateUI( 'Control', 'Camera')
        }

        // Procedural Generation
        if ( Input.isKeyPressed( '13' )) { // 'Enter' key
            this.updateUI( 'Procedural Generation', document.getElementById( 'seedInput' ))
        }

    }

    /**
     * Updates the ui to represent the current interaction
     * @param { String } category The ui category to use; see this.ui_categories for reference
     * @param { String } name The name of the item within the category
     * @param { String | null } value The value to use if the ui element is not a toggle; sets the element to given string 
     */
    updateUI( category, name, value = null )
    {
        this.ui_state[category] = name
        for ( let key in this.ui_categories[ category ] )
        {

            this.updateUIElement( this.ui_categories[ category ][ key ], key == name, value )

        }

    }

    /**
     * Updates a single ui element with given state and value
     * @param { Element } el The dom element to update
     * @param { Boolean } state The state (active / inactive) to update it to
     * @param { String | null } value The value to use if the ui element is not a toggle; sets the element to given string 
     */
    updateUIElement( el, state, value )
    {

        el.classList.remove( state ? 'inactive' : 'active' )
        el.classList.add( state ? 'active' : 'inactive' )

        if ( state && value != null )
            el.innerHTML = value

    }

}

export default AppState
