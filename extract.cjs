const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/;

const styleMatch = content.match(styleRegex);
const scriptMatch = content.match(scriptRegex);

if (styleMatch) {
  fs.writeFileSync(path.join(__dirname, 'src/style.css'), styleMatch[1].trim() + '\n');
}

if (scriptMatch) {
  let js = scriptMatch[1].trim() + '\n';
  
  // Transform global THREE references to ES module imports
  js = `import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';\n\n` + js;

  // Remove the !window.THREE check
  js = js.replace(/if \(!window\.THREE\) \{[\s\S]*?return;\s*\}/, '');
  
  fs.writeFileSync(path.join(__dirname, 'src/main.ts'), js);
}

// Now replace the content in index.html
let newHtml = content.replace(styleRegex, '<link rel="stylesheet" href="/src/style.css">');
newHtml = newHtml.replace(scriptRegex, '<script type="module" src="/src/main.ts"></script>');

// Remove the CDN imports
const cdnRegex = /<!-- UMD \(global THREE\) builds — these load fine from file:\/\/ -->[\s\S]*?<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/examples\/js\/loaders\/GLTFLoader\.js"><\/script>\n/;
newHtml = newHtml.replace(cdnRegex, '');

// Update SEO and Favicon
const headEnd = newHtml.indexOf('</head>');
const beforeHead = newHtml.substring(0, headEnd);
const afterHead = newHtml.substring(headEnd);

let updatedBeforeHead = beforeHead.replace(/<title>AeroVision — Anantam Racing<\/title>/, `<title>AeroVision — Anantam Racing</title>
  <meta name="description" content="AeroVision — Advanced aerodynamic visualization and telemetry suite engineered for Team Anantam Racing." />
  <link rel="icon" href="https://anantamracing.com/assets/favicon/favicon-dark.png" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="https://anantamracing.com/assets/favicon/favicon-light.png" media="(prefers-color-scheme: light)">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`);

fs.writeFileSync(htmlPath, updatedBeforeHead + afterHead);

console.log('Extraction complete');
