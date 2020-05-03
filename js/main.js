import * as THREE from 'https://unpkg.com/three@0.115.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.115.0/examples/jsm/controls/OrbitControls.js';

console.log("Three.js r" + THREE.REVISION);

var renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

//#region Resources
var manager = new THREE.LoadingManager();

var path = "./textures/cube/";
var prefix = ``;//`dark-s_`;
var format = '.jpg';
var urls = [
    path + prefix + 'posx' + format, path + prefix + 'negx' + format,
    path + prefix + 'posy' + format, path + prefix + 'negy' + format,
    path + prefix + 'posz' + format, path + prefix + 'negz' + format
];

var cubeTextureLoader = new THREE.CubeTextureLoader(manager);

var reflectionCube = cubeTextureLoader.load(urls);

var textureLoader = new THREE.TextureLoader(manager);
var texAum = textureLoader.load("./textures/aum.png");
var texBenares = textureLoader.load("./textures/benares.png");
//#endregion

//#region Back
var texture
var cameraBack = new THREE.Camera();
var sceneBack = new THREE.Scene();
var backPlaneGeom = new THREE.PlaneBufferGeometry(2, 2);

var backUniforms = {
    texBenares: {
        value: texBenares
    },
    screenRatio: {
        value: innerWidth / innerHeight
    },
    time: {
        value: 0
    }
}
var backPlaneMat = new THREE.ShaderMaterial({
    uniforms: backUniforms,
    vertexShader:`
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
    `,
    fragmentShader:`
    uniform sampler2D texBenares;
    uniform float screenRatio;
    uniform float time;

    varying vec2 vUv;

    void main() {
        vec2 uv = vUv;
        vec3 col = vec3(0);
        
        float ratio = screenRatio * 0.5;
        vec2 bUv = vUv;
        bUv.x *= ratio;
        bUv.x += 0.5 * (1. - ratio);
        bUv.y *=2.;
        bUv.y -=1.;
        float s = sign(bUv.y);
        bUv.y = abs(bUv.y);
        vec2 offset = vec2(0);
        if (s < 0.) {
            float m2 = (pow(bUv.y, 0.5));
            offset.x = cos( time  * -2. + bUv.y * 30. * m2) * 0.013 + sin( time  * -2.3 + bUv.x * 45. * m2) * 0.01;
            offset.y = sin( time  * -3. + bUv.x * 15. * m2) * 0.01 + cos( time  * -2.7 + bUv.y * 7. * m2) * 0.025;
        }

        vec4 benares = texture2D(texBenares, bUv + offset * (0.5 + bUv.y));
        float bStencil = benares.r;
        
        float m = s < 0. ? 0.95 : 1.;
        col = vec3(1, 0.5, 0.25) * m;
        col = mix(col, vec3(1, 0.75, 0.5) * m, bStencil);

        gl_FragColor = vec4(col, 1.0);
    }
    `
});


var backPlane = new THREE.Mesh(backPlaneGeom, backPlaneMat);
sceneBack.add(backPlane);
//#endregion

//#region Front
var sceneFront = new THREE.Scene();
var cameraFront = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
cameraFront.position.set(3, 3, 3).setLength(3.75);

var controls = new OrbitControls(cameraFront, renderer.domElement);

//sceneFront.background = reflectionCube;

var light = new THREE.DirectionalLight(0xffffff, 0.125);
light.position.set(0, -1, 0);
sceneFront.add(light);
sceneFront.add(new THREE.AmbientLight(0xffffff, 0.875));

//sceneFront.add(new THREE.GridHelper(10, 10));

var spheresAmount = 12;
var angleStep = Math.PI / spheresAmount;

var spheres = [];
var corpuscules = [];

var sphereColor = 0xdd4444; //0x884444;
var sGeom = new THREE.SphereBufferGeometry(0.075, 16, 16);
var sMat = new THREE.MeshLambertMaterial({
    color: sphereColor,
    envMap: reflectionCube,
    reflectivity: 0.0625
});

var icosahedronGeom = new THREE.IcosahedronGeometry(1, 0);
for (let i = 0; i < spheresAmount; i++) {
    let sphere = new THREE.Mesh(sGeom, sMat);
    sphere.userData.dirVector = new THREE.Vector3().copy(icosahedronGeom.vertices[i]);
    sphere.userData.dirTheta = Math.random() * Math.PI;
    spheres.push(sphere);
    sceneFront.add(sphere);
    corpuscules.push(sphere.position);
}

//var mainSphereGeom = new THREE.SphereBufferGeometry(1.25, 144, 144).toNonIndexed();
var mainSphereGeom = new THREE.BoxBufferGeometry(2, 2, 2, 50, 50, 50);
// make a sphere from the box
var sPos = mainSphereGeom.attributes.position;
var sNorm = mainSphereGeom.attributes.normal;
var temp = new THREE.Vector3();
var sides = [];
for (let i = 0; i < sPos.count; i++){

    temp.fromBufferAttribute(sPos, i);
    temp.normalize();

    sPos.setXYZ(i, temp.x, temp.y, temp.z);
    sNorm.setXYZ(i, temp.x, temp.y, temp.z);
    sides.push(Math.floor(i / (51 * 51)));
}
//mainSphereGeom = mainSphereGeom.toNonIndexed();
mainSphereGeom.setAttribute("sides", new THREE.Float32BufferAttribute(sides, 1));


var mainSphereMat = new THREE.MeshLambertMaterial({
    color: 0x333366,
    envMap: reflectionCube,
    reflectivity: 0.125
});
mainSphereMat.defines = {"USE_UV":""};
mainSphereMat.extensions = {derivatives: true};
var uniforms = {
    corpuscules: {
        value: corpuscules
    },
    texAum: {
        value: texAum
    },
    time: {
        value: 0
    }
};
mainSphereMat.onBeforeCompile = shader => {
    shader.uniforms.corpuscules = uniforms.corpuscules;
    shader.uniforms.texAum = uniforms.texAum;
    shader.uniforms.time = uniforms.time;
    shader.vertexShader = `
      uniform vec3 corpuscules[${spheresAmount}];
      attribute float sides;
      varying float vSides;
  ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>

    vSides = sides;
    
    vec3 accumulate = vec3(0);
    float shortestDist = 1000.;
    
    for(int i = 0; i < ${spheresAmount}; i++){
    	vec3 sPos = corpuscules[i];
      vec3 diff = sPos - transformed;
      vec3 dir = normalize(diff);
      float dist = length(diff);
      shortestDist = min(shortestDist, dist);
      
      float force = .0125 / (dist * dist);
      vec3 forceVec = dir * force;
      
      accumulate += forceVec;
    }
    
    vec3 normAccumulate = normalize(accumulate);
    
    float accumulateLength = clamp(length(accumulate), 0., shortestDist);
    accumulate = normAccumulate * accumulateLength;

    float distRatio = accumulateLength / shortestDist;

    transformed += accumulate;
   
    // re-compute normals    
    vec3 n0 = vec3(normal);
    vec3 n1 = cross(normAccumulate, n0);
    vec3 n2 = cross(n1, normAccumulate);
    vec3 finalNormal = mix(n0, n2, distRatio);
    transformedNormal = normalMatrix * finalNormal;
    `
    );
    
    shader.fragmentShader = `
        uniform sampler2D texAum;
        uniform float time;
        varying float vSides;

        //  https://www.shadertoy.com/view/MsS3Wc
        vec3 hsb2rgb( in vec3 c ){
            vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
                                    6.0)-3.0)-1.0,
                            0.0,
                            1.0 );
            rgb = rgb*rgb*(3.0-2.0*rgb);
            return c.z * mix( vec3(1.0), rgb, c.y);
        }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
        
        float texVal = texture2D( texAum, vUv ).r;
        
        vec2 uv = vUv;
        uv -= 0.5;
        uv *= 108.;

        float a = atan(uv.x,uv.y)+PI;
        float r = PI2/floor(3. + floor(mod(time + vSides, 6.)));
        float d = cos(floor(.5+a/r)*r-a)*length(uv);
        
        float e = length(fwidth(uv)) * 0.5;
        /*float s = smoothstep(15. - e, 15., d ) - smoothstep(15., 15. + e, d);*/
        float waveVal = /*s > 0.5 ? 1. : */ sin((d - time) * PI2) * 0.5 + 0.5;

        vec3 col = vec3(0);
        col = vec3(0, 0.5, 1) * 0.5;
        col = hsb2rgb(vec3((1./6.) * vSides * (PI / 3.) + time, .125, .5));
        //col = mix(col, vec3(0.5, 0.25, 0), waveVal);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, col, texVal * waveVal);
        `
    );
    //console.log(shader.fragmentShader);
}
var mainSphere = new THREE.Mesh(mainSphereGeom, mainSphereMat);
sceneFront.add(mainSphere);
//#endregion

window.addEventListener('resize', onWindowResize, false);

var clock = new THREE.Clock();

renderer.setAnimationLoop(() => {

    let t = clock.getElapsedTime() * 0.75;

    spheres.forEach((s, idx) => {

        s.position.copy(s.userData.dirVector).multiplyScalar(Math.sin(s.userData.dirTheta + t) * 2);

    });
    uniforms.time.value = t;
    backUniforms.time.value = t;

    renderer.clear();
    renderer.render(sceneBack, cameraBack);
    renderer.clearDepth();
    renderer.render(sceneFront, cameraFront)

});

function onWindowResize() {

    cameraFront.aspect = innerWidth / innerHeight;
    cameraFront.updateProjectionMatrix();

    backUniforms.screenRatio.value = innerWidth / innerHeight; 

    renderer.setSize(innerWidth, innerHeight);

}
