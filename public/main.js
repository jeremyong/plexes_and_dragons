const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const rect = canvas.getBoundingClientRect();
let backdrop = null;
let reticle = null;
let reticleLoaded = false;
let back_width = 0;
let back_height = 0;
let orb_width = 0;

let reticle_x = 0;
let reticle_y = 0;
let target_x = 0;
let target_y = 0;

const references = {
  "heart":{"r":223.59669421487607,"g":61.689256198347124,"b":152.1652892561983,"l":120.41384793388428},
  "water":{"r":74.9801652892562,"g":159.11239669421482,"b":224.76198347107436,"l":141.4409123966942},
  "fire":{"r":240.9619834710743,"g":116.71570247933886,"b":90.91900826446283,"l":150.92451735537188},
  "dark":{"r":149.52231404958675,"g":82.90413223140496,"b":165.45289256198345,"l":112.23352727272727},
  "light":{"r":247.84793388429756,"g":242.93884297520668,"b":149.5239669421487,"l":233.75736528925617},
  "wood":{"r":85.6528925619835,"g":184.52066115702482,"b":108.79008264462806,"l":146.32591239669426}
};

const reference_order = [
  "heart", "dark", "light", "dark", "wood", "fire",
  "fire", "water", "water", "fire", "wood", "dark",
  "fire", "light", "heart", "water", "light", "dark",
  "dark", "wood", "wood", "fire", "dark", "wood",
  "water", "wood", "light", "water", "water", "wood",
];

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

let dragActive = false;

canvas.addEventListener('mousedown', (e) => {
  dragActive = true;
  positionReticle(e);
});
canvas.addEventListener('mousemove', positionReticle);
canvas.addEventListener('mouseup', () => dragActive = false);

function positionReticle(e) {
  if (!dragActive) {
    return;
  }
  target_x = e.clientX - rect.left;
  target_y = e.clientY - rect.top;
  reticle_x = target_x - 25;
  reticle_y = target_y - 25;
  render();
}

const gl_preview = preview.getContext("webgl");
gl_preview.clearColor(0.0, 0.0, 0.0, 1.0);
gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);

const gl = canvas.getContext("webgl", {
  preserveDrawingBuffer: true,
});
const sample_framebuffer = gl.createFramebuffer();
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);
gl.clearColor(0.0, 1.0, 0.0, 1.0);
let pixels = null;

function render(displayReticle = true) {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, back_width, back_height);

  if (backdrop) {
    backdrop(0, 0);

    if (!pixels) {
      pixels = readRaster();
    }
  }

  if (displayReticle && reticle) {
    reticle(reticle_x, reticle_y);
  }
}

function setPreviewColor(r, g, b) {
  gl_preview.clearColor(r / 255, g / 255, b / 255, 1.0);
  gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);
}

function readRaster() {
  const buffer = new Uint8Array(back_width * back_height * 4);
  gl.readPixels(0, 0, back_width, back_height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  return buffer;
}

// WebGL rasters read +x to the right and +y down
function pixelAt(x, y) {
  return {
    r: pixels[y * back_width * 4 + x * 4],
    g: pixels[y * back_width * 4 + x * 4 + 1],
    b: pixels[y * back_width * 4 + x * 4 + 2],
  };
}

function jitter(x, y, delta = 5) {
  const points = [{ x, y }];
  points.push({
    x: x - delta,
    y: y,
  });
  points.push({
    x: x + delta,
    y: y,
  });
  points.push({
    x: x,
    y: y + delta,
  });
  points.push({
    x: x,
    y: y - delta,
  });
  for (let i = 0; i !== points.length; i += 1) {
    const x = points[i].x;
    points[i].x = Math.max(Math.min(x, back_width - 1), 0);
    const y = points[i].y;
    points[i].y = Math.max(Math.min(y, back_height - 1), 0);
  }
  return points;
}

function sampleColors() {
  console.log(target_x, target_y);
  const { r, g, b } = sampleAt(target_x, target_y);
  console.log(r, g, b);
  setPreviewColor(r, g, b);
}

function extractReferences() {
  const positions = {
    heart: { x: 27, y: 312 },
    water: { x: 127, y: 362 },
    fire: { x: 177, y: 362 },
    dark: { x: 177, y: 312 },
    light: { x: 127, y: 312 },
    wood: { x: 227, y: 312 },
  };

  let results = {};
  Object.keys(positions).forEach((key) => {
    const { x, y } = positions[key];
    results[key] = analyze(x, y);
  });
  console.log(JSON.stringify(results));
}

function analyze(x, y) {
  /*
  const points = jitter(x || target_x, y || target_y);
  const samples = [];
  for (let i = 0; i !== points.length; i += 1) {
    const { x, y } = points[i];
    samples.push(sampleAt(x, y));
    const points_2 = jitter(x, y, 1);
    for (let j = 0; j !== points_2.length; j += 1) {
      const { x: x2, y: y2 } = points_2[j];
      samples.push(sampleAt(x2, y2));
    }
  }
  */
  if (x === undefined) {
    x = target_x;
  }

  if (y === undefined) {
    y = target_y;
  }

  const samples = [];
  for (let i = x - 5; i != x + 6; i += 1) {
    for (let j = y - 5; j != y + 6; j += 1) {
      samples.push(sampleAt(i, j));
    }
  }

  // Average sample components
  let r_avg = 0;
  let b_avg = 0;
  let g_avg = 0;
  let l_avg = 0;
  for (let i = 0; i !== samples.length; i += 1) {
    r_avg += samples[i].r;
    g_avg += samples[i].g;
    b_avg += samples[i].b;
    l_avg += luminance(samples[i].r, samples[i].g, samples[i].b);
  }
  r_avg /= samples.length;
  g_avg /= samples.length;
  b_avg /= samples.length;
  l_avg /= samples.length;

  console.log(r_avg, g_avg, b_avg, l_avg);

  // Compute variances
  let r_var = 0;
  let g_var = 0;
  let b_var = 0;
  let l_var = 0;
  for (let i = 0; i !== samples.length; i += 1) {
    r_var += Math.pow(samples[i].r - r_avg, 2);
    g_var += Math.pow(samples[i].g - g_avg, 2);
    b_var += Math.pow(samples[i].b - b_avg, 2);
    l_var += Math.pow(luminance(samples[i].r, samples[i].g, samples[i].b) - l_avg, 2);
  }

  const var_sum = r_var + g_var + b_var + l_var;

  const r_w = r_var / var_sum;
  const g_w = g_var / var_sum;
  const b_w = b_var / var_sum;
  const l_w = l_var / var_sum;
  console.log(r_w, g_w, b_w, l_w);
  return {
    r: r_avg,
    g: g_avg,
    b: b_avg,
    l: l_avg,
  }
}

function sampleAt(x, y) {
  const points = jitter(x, back_height - y);
  let sum_r = 0;
  let sum_g = 0;
  let sum_b = 0;
  for (let i = 0; i !== points.length; i += 1) {
    const { r, g, b } = pixelAt(points[i].x, points[i].y);
    sum_r += r;
    sum_g += g;
    sum_b += b;
  }
  const r = sum_r / points.length;
  const g = sum_g / points.length;
  const b = sum_b / points.length;
  return { r, g, b };
}

function identify(r, g, b) {
  let min_error = Infinity;
  let result = null;
  Object.keys(references).forEach((key) => {
    const v = references[key];
    const error = (
      Math.pow(v.r - r, 2) +
      Math.pow(v.g - g, 2) +
      Math.pow(v.b - b, 2) +
      0 * Math.pow(luminance(r, g, b) - v.l, 2));
    if (error < min_error) {
      min_error = error;
      result = key;
    }
  });

  if (result === 'heart' || result === 'dark') {
    if (Math.pow(r - references['heart'].r, 2) < Math.pow(r - references['dark'].r, 2)) {
      result = 'heart';
    } else {
      result = 'dark';
    }
  }

  if (result === 'fire' || result === 'light') {
    if (Math.pow(g - references['fire'].g, 2) < Math.pow(g - references['light'].g, 2)) {
      result = 'fire';
    } else {
      result = 'light';
    }
  }

  return {
    result,
    error: min_error,
  };
}

function scan() {
  let x_0 = target_x;
  let y_0 = target_y;
  let min_error = Infinity;
  // Search in a 20x20 box for a good starting point
  /*
  for (let i = Math.max(x_0 - 10, 0); i !== x_0 + 10 && i !== back_width; i += 1) {
    for (let j = Math.max(x_0 - 10, 0); j !== x_0 + 10 && j !== back_height; j += 1) {
      const { error } = identify(i, j);
      if (error < min_error) {
        x_0 = i;
        y_0 = j;
        min_error = error;
      }
    }
  }
  */


  let index = 0;
  const results = [];
  for (let i = 0; i !== 5; i += 1) {
    for (let j = 0; j !== 6; j += 1) {
      const x = orb_width * j + x_0;
      const y = orb_width * i + y_0;
      const { r, g, b } = sampleAt(x, y);
      const { result } = identify(r, g, b);
      if (result !== reference_order[index]) {
        console.log(`Misidentified ${reference_order[index]} as ${result} at (${i}, ${j})`);
      }
      results.push(result);
      index += 1;
    }
  }
  console.log(results);
}

function handleFile() {
  const file = document.getElementById("input").files[0];
  const image = new Image();
  const reader = new FileReader();
  reader.onload = (e) => {
    image.src = e.target.result;
    image.onload = function () {
      pixels = null;
      handleSample(image);
      render();
    };
  };
  reader.readAsDataURL(file);
}

function handleReticle() {
  if (reticleLoaded) {
    return;
  }

  if (!backdrop) {
    return;
  }

  reticleLoaded = true;

  const reticleImage = document.getElementById("reticle");
  const sampleImage = document.getElementById("sample");
  orb_width = back_width / 6.0;
  reticle = initImage(reticleImage, orb_width, orb_width);

  render();
}

function handleSample(image) {
  const sampleImage = image || document.getElementById("sample");
  back_width = 300;
  back_height = Math.floor(sampleImage.height * 300 / sampleImage.width);
  canvas.width = back_width;
  canvas.height = back_height;

  backdrop = initImage(sampleImage, back_width, back_height, sample_framebuffer);

  handleReticle();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

function rectangle(x, y, width, height) {
  x2 = x + width;
  y2 = y + height;
  return [
    x, y,
    x2, y,
    x, y2,
    x, y2,
    x2, y,
    x2, y2
  ];
}

// returns a draw call that will render an image
function initImage(image, width, height, fb) {
  const vertexShaderSource = document.getElementById('2d-vertex-shader').text;
  const fragmentShaderSource = document.getElementById('2d-fragment-shader').text;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = createProgram(gl, vertexShader, fragmentShader);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangle(0, 0, width, height)), gl.STATIC_DRAW);

  const texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangle(0, 0, 1, 1)), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  if (fb) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const displacement = gl.getUniformLocation(program, "u_displacement");

  return (x, y) => {
    gl.useProgram(program);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texcoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionLocation, back_width, back_height);

    gl.uniform2f(displacement, x, y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}
