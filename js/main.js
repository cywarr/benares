import * as THREE from 'https://threejs.org/build/three.module.js';
import { OrbitControls } from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3, 3, 3).setLength(3.75);
var renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(innerWidth, innerHeight);
var backColor = 0xff8844;
renderer.setClearColor(backColor);
document.body.appendChild(renderer.domElement);

var controls = new OrbitControls(camera, renderer.domElement);

var path = "./textures/cube/";
var prefix = ``;//`dark-s_`;
var format = '.jpg';
var urls = [
    path + prefix + 'posx' + format, path + prefix + 'negx' + format,
    path + prefix + 'posy' + format, path + prefix + 'negy' + format,
    path + prefix + 'posz' + format, path + prefix + 'negz' + format
];

var cubeTextureLoader = new THREE.CubeTextureLoader();

var reflectionCube = cubeTextureLoader.load(urls);

var textureLoader = new THREE.TextureLoader();
var texAum = textureLoader.load("./textures/aum.png");
var texBenares = textureLoader.load("./textures/benares.png");

//scene.background = reflectionCube;

var light = new THREE.DirectionalLight(0xffffff, 0.125);
light.position.set(0, -1, 0);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.875));

//scene.add(new THREE.GridHelper(10, 10));

var spheresAmount = 12;
var angleStep = Math.PI / spheresAmount;

var spheres = [];
var corpuscules = [];

var sphereColor = 0x884444;
var sGeom = new THREE.SphereBufferGeometry(0.075, 16, 16);
var sMat = new THREE.MeshLambertMaterial({
    color: sphereColor,
    envMap: reflectionCube,
    reflectivity: 0.125
});

var icosahedronGeom = new THREE.IcosahedronGeometry(1, 0);
for (let i = 0; i < spheresAmount; i++) {
    let sphere = new THREE.Mesh(sGeom, sMat);
    sphere.userData.dirVector = new THREE.Vector3().copy(icosahedronGeom.vertices[i]);
    sphere.userData.dirTheta = Math.random() * Math.PI;
    spheres.push(sphere);
    scene.add(sphere);
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
    color: 0x222244,
    envMap: reflectionCube,
    reflectivity: 0.25
});
mainSphereMat.defines = {"USE_UV":""};
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
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
        
        float texVal = texture2D( texAum, vUv ).r;
        
        vec2 uv = vUv;
        uv -= 0.5;
        uv *= 20.25;

        float a = atan(uv.x,uv.y)+PI;
        float r = PI2/floor(1. + floor(mod(time + vSides, 6.)));
        float d = cos(floor(.5+a/r)*r-a)*length(uv);

        float waveVal = sin((d - time) * PI2) * 0.5 + 0.5;

        vec3 col = vec3(0);
        col = vec3(0, 0.5, 1) * 0.5;
        //col = mix(col, vec3(0.5, 0.25, 0), waveVal);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, col, texVal * waveVal);
        `
    );
    //console.log(shader.fragmentShader);
}
var mainSphere = new THREE.Mesh(mainSphereGeom, mainSphereMat);
scene.add(mainSphere);

window.addEventListener('resize', onWindowResize, false);

var clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    let t = clock.getElapsedTime() * 0.75;
    spheres.forEach((s, idx) => {

        s.position.copy(s.userData.dirVector).multiplyScalar(Math.sin(s.userData.dirTheta + t) * 2);

    });
    uniforms.time.value = t;
    renderer.render(scene, camera)
});

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}
