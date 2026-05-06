/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/main.ts"
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
() {

eval("{\nasync function checkWebGPUSupport() {\n    const outputDiv = document.getElementById('output');\n    if (!outputDiv) {\n        console.error('Output div not found');\n        return;\n    }\n    // Check if WebGPU is supported\n    if (!navigator.gpu) {\n        outputDiv.innerHTML = `\n        <p>❌ WebGPU is NOT supported in this browser.</p>\n        <p>Please use Chrome/Edge 113+ with WebGPU enabled.</p>\n    `;\n        console.error('WebGPU is not supported');\n        return;\n    }\n    outputDiv.innerHTML = '<p>✅ WebGPU is supported!</p>';\n    console.log('WebGPU is supported!');\n    try {\n        // Request GPU adapter\n        const adapter = await navigator.gpu.requestAdapter();\n        if (!adapter) {\n            outputDiv.innerHTML += '<p>❌ Failed to get GPU adapter.</p>';\n            console.error('Failed to get GPU adapter');\n            return;\n        }\n        outputDiv.innerHTML += '<p>✅ GPU Adapter obtained!</p>';\n        console.log('GPU Adapter:', adapter);\n        outputDiv.innerHTML += '<p>🎉 WebGPU is functional!</p>';\n    }\n    catch (error) {\n        outputDiv.innerHTML += `<p>❌ Error: ${error}</p>`;\n        console.error('WebGPU Error:', error);\n    }\n}\n// Run the check when DOM is loaded\ndocument.addEventListener('DOMContentLoaded', checkWebGPUSupport);\n\n\n//# sourceURL=webpack://webgpu-hello/./src/main.ts?\n}");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/main.ts"]();
/******/ 	
/******/ })()
;