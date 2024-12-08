#version 300 es

// an attribute will receive data from a buffer
in vec3 a_position;
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_texture_coord;

// transformation matrices
uniform mat4x4 u_m;
uniform mat4x4 u_v;
uniform mat4x4 u_p;

uniform mediump int is_depth;
uniform mat4x4 lightSpaceMatrix;
out vec4 positionFromLight;


// output to fragment stage
// TODO: Create varyings to pass data to the fragment stage (position, texture coords, and more)
out vec3 o_position;
out vec2 o_texture_coord;
out mat3 o_tbn;
out vec3 o_vertex_normal_world;

void main() {
	if(is_depth == 2 || is_depth == 3) {
		gl_Position = vec4(a_position, 1);
		return;
	}

    if(is_depth == 0) {
        // transform a vertex from object space directly to screen space
        // the full chain of transformations is:
        // object space -{model}-> world space -{view}-> view space -{projection}-> clip space
        vec4 vertex_position_world = u_m * vec4(a_position, 1.0);
        mat3 norm_matrix = transpose(inverse(mat3(u_m)));
        vec3 normal = normalize(norm_matrix * a_normal);
        o_vertex_normal_world = normal.xyz;
        
        // TODO: Construct TBN matrix from normals, tangents and bitangents
        vec3 tangent = normalize(vec3(u_m * vec4(a_tangent, 0.0)));
        // TODO: Use the Gram-Schmidt process to re-orthogonalize tangents
        tangent = normalize(tangent - dot(tangent, normal) * normal);
        vec3 bitangent = cross(normal, tangent);

        // NOTE: Different from the book, try to do all calculations in world space using the TBN to transform normals
        // HINT: Refer to https://learnopengl.com/Advanced-Lighting/Normal-Mapping for all above
        
        mat3 tbn = mat3(tangent, bitangent, normal);

        // TODO: Forward data to fragment stage
        o_position = vertex_position_world.xyz;
        o_texture_coord = a_texture_coord;
        o_tbn = tbn;

        gl_Position = u_p * u_v * vertex_position_world;
		positionFromLight = lightSpaceMatrix * u_m * vec4(a_position, 1.0f);

    } else {
        gl_Position = lightSpaceMatrix * u_m * vec4(a_position, 1.0f);
    }
}