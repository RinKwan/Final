#version 300 es

#define MAX_LIGHTS 16

// Fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision".
precision mediump float;

uniform mediump int is_depth;
in  vec4 positionFromLight;
//uniform mediump sampler2DShadow shadowMap;
uniform sampler2D shadowMap0;
uniform sampler2D shadowMap1;
//out float fragDepth;

uniform bool u_show_normals;

// struct definitions
struct AmbientLight {
    vec3 color;
    float intensity;
};

struct DirectionalLight {
    vec3 direction;
    vec3 color;
    float intensity;
};

struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
};

struct Material {
    vec3 kA;
    vec3 kD;
    vec3 kS;
    float shininess;
    sampler2D map_kD;
    sampler2D map_nS;
    sampler2D map_norm;
};

// lights and materials
uniform AmbientLight u_lights_ambient[MAX_LIGHTS];
uniform DirectionalLight u_lights_directional[MAX_LIGHTS];
uniform PointLight u_lights_point[MAX_LIGHTS];

uniform Material u_material;

// texture check
uniform bool u_has_texture;

// camera position in world space
uniform vec3 u_eye;

// with webgl 2, we now have to define an out that will be the color of the fragment
out vec4 o_fragColor;

// received from vertex stage
// TODO: Create variables to receive from the vertex stage
in vec3 o_position;
in vec2 o_texture_coord;
in mat3 o_tbn;
in vec3 o_vertex_normal_world;

// Shades an ambient light and returns this light's contribution
vec3 shadeAmbientLight(Material material, AmbientLight light) {

    // TODO: Implement this
    // TODO: Include the material's map_kD to scale kA and to provide texture even in unlit areas
    // NOTE: We could use a separate map_kA for this, but most of the time we just want the same texture in unlit areas
    // HINT: Refer to http://paulbourke.net/dataformats/mtl/ for details
    // HINT: Parts of ./shaders/phong.frag.glsl can be re-used here
    if (light.intensity == 0.0)
        return vec3(0);

    if (!u_has_texture) 
        return light.color * light.intensity * material.kA;

    vec3 texture_color = texture(u_material.map_kD, o_texture_coord).rgb;
    return light.color * light.intensity * material.kA * texture_color;
}

// Shades a directional light and returns its contribution
vec3 shadeDirectionalLight(Material material, DirectionalLight light, vec3 normal, vec3 eye, vec3 vertex_position) {
    
    // TODO: Implement this
    // TODO: Use the material's map_kD and map_nS to scale kD and shininess
    // HINT: The darker pixels in the roughness map (map_nS) are the less shiny it should be
    // HINT: Refer to http://paulbourke.net/dataformats/mtl/ for details
    // HINT: Parts of ./shaders/phong.frag.glsl can be re-used here

    vec3 result = vec3(0);
    if (light.intensity == 0.0)
        return result;

    vec3 N = normalize(normal);
    vec3 L = -normalize(light.direction);
    vec3 V = normalize(vertex_position - eye);

    // normal Phong shading for non textured objects
    if (!u_has_texture) {
        // Diffuse
        float LN = max(dot(L, N), 0.0);
        result += LN * light.color * light.intensity * material.kD;

        // Specular
        vec3 R = reflect(L, N);
        result += pow( max(dot(R, V), 0.0), material.shininess) * light.color * light.intensity * material.kS;


        return result;
    }

    // Diffuse
    vec4 diffuse_texture = texture(material.map_kD, o_texture_coord);
    if (diffuse_texture == vec4(0.0)) diffuse_texture = vec4(1.0); // map_kD default
    float LN = max(dot(L, N), 0.0);
    result += LN * light.color * light.intensity * material.kD * diffuse_texture.rgb;

    // Specular
    vec4 specular_texture = texture(material.map_nS, o_texture_coord);
    if (specular_texture == vec4(0.0)) specular_texture = vec4(1.0); // map_nS default
    float shininess = material.shininess * (1.0 - specular_texture.r);
    vec3 R = reflect(L, N);
    result += pow( max(dot(R, V), 0.0), shininess) * light.color * light.intensity * material.kS;

    return result;
}

// Shades a point light and returns its contribution
vec3 shadePointLight(Material material, PointLight light, vec3 normal, vec3 eye, vec3 vertex_position) {

    // TODO: Implement this
    // TODO: Use the material's map_kD and map_nS to scale kD and shininess
    // HINT: The darker pixels in the roughness map (map_nS) are the less shiny it should be
    // HINT: Refer to http://paulbourke.net/dataformats/mtl/ for details
    // HINT: Parts of ./shaders/phong.frag.glsl can be re-used here

    vec3 result = vec3(0);
    if (light.intensity == 0.0)
        return result;

    vec3 N = normalize(normal);
    float D = distance(light.position, vertex_position);
    vec3 L = normalize(light.position - vertex_position);
    vec3 V = normalize(vertex_position - eye);

    // normal Phong shading for non textured objects
    if (!u_has_texture) {
        // Diffuse
        float LN = max(dot(L, N), 0.0);
        result += LN * light.color * light.intensity * material.kD;

        // Specular
        vec3 R = reflect(L, N);
        result += pow( max(dot(R, V), 0.0), material.shininess) * light.color * light.intensity * material.kS;

        // Attenuation
        result *= 1.0 / (D*D+1.0);

        return result;
    }

    // Diffuse
    vec4 diffuse_texture = texture(material.map_kD, o_texture_coord);
    if (diffuse_texture == vec4(0.0)) diffuse_texture = vec4(1.0); // map_kD default
    float LN = max(dot(L, N), 0.0);
    result += LN * light.color * light.intensity * material.kD * diffuse_texture.rgb;

    // Specular
    vec4 specular_texture = texture(material.map_nS, o_texture_coord);
    if (specular_texture == vec4(0.0)) specular_texture = vec4(1.0);// map_nS default
    float shininess = material.shininess * (1.0 - specular_texture.r);
    vec3 R = reflect(L, N);
    result += pow( max(dot(R, V), 0.0),shininess) * light.color * light.intensity * material.kS;

    // Attenuation
    result *= 1.0 / (D*D+1.0);

    return result;
}

void main() {

	if(is_depth == 0) {

		// o_fragColor = vec4(o_tbn[2], 1.0);
		// TODO: Calculate the normal from the normal map and tbn matrix to get the world normal
		vec3 normal = texture(u_material.map_norm, o_texture_coord).rgb;
		normal = normal * 2.0 - 1.0;
		normal = normalize(o_tbn * normal);

		// normal Phong shading
		if (!u_has_texture) {
			normal = o_vertex_normal_world;
		}

		// if we only want to visualize the normals, no further computations are needed
		// !do not change this code!
		if (u_show_normals == true) {
			o_fragColor = vec4(normal, 1.0);
			return;
		}

		// we start at 0.0 contribution for this vertex
		vec3 light_contribution = vec3(0.0);

		// iterate over all possible lights and add their contribution
		for(int i = 0; i < MAX_LIGHTS; i++) {
			// TODO: Call your shading functions here like you did in A5
			light_contribution += shadeAmbientLight(u_material, u_lights_ambient[i]);
			light_contribution += shadePointLight(u_material, u_lights_point[i], normalize(normal), u_eye, normalize(o_position));
			light_contribution += shadeDirectionalLight(u_material, u_lights_directional[i], normalize(normal), u_eye, normalize(o_position));
		}

		o_fragColor = vec4(light_contribution, 1.0);

		vec4 positionFromLightInTexture = positionFromLight * 0.5 + 0.5;
		vec3 biased = vec3(positionFromLightInTexture.xy, positionFromLightInTexture.z - 0.05);
		vec4 shadowmap_color = texture(shadowMap0, biased.xy) + texture(shadowMap1, biased.xy);
		float hit = shadowmap_color.r;

		light_contribution *= hit;

		o_fragColor = vec4(light_contribution, 1.0);
		// o_fragColor.xyz = positionFromLightInTexture.xyz; //vec3(hit/2.0,hit/2.0,hit/2.0).xy ;
		//
		//	o_fragColor.z = hit;
		o_fragColor.x = shadowmap_color.r ;
		o_fragColor.y = shadowmap_color.g;
		o_fragColor.z = shadowmap_color.b;

	} else {
		// o_fragColor = vec4(0.5, 0.1, 0, 1);
		gl_FragDepth = gl_FragCoord.z;
		o_fragColor = vec4(gl_FragDepth, 0, 0, 1);
	}
}