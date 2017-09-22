const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const rect = canvas.getBoundingClientRect();
let backdrop = null;
let filtered_backdrop = null;
let filter_enabled = 0;
let reticle = null;
let reticleLoaded = false;
let back_width = 0;
let back_height = 0;
let orb_width = 0;

let reticle_x = 0;
let reticle_y = 0;
let target_x = 0;
let target_y = 0;

const reference_luminance = 128 / 255;

const tolerance = 20;

function check(r, g, b, r1, g1, b1) {
  return Math.abs(r - r1) < tolerance
    && Math.abs(g - g1) < tolerance
    && Math.abs(b - b1) < tolerance;
}

const types = {
  light: (r, g, b) => {
    return check(r, g, b, 169, 154, 97);
  },

  dark: (r, g, b) => {
    return check(r, g, b, 145, 91, 140);
  },

  fire: (r, g, b) => {
    return check(r, g, b, 179, 98, 84);
  },

  wood: (r, g, b) => {
    return check(r, g, b, 94, 152, 111);
  },

  water: (r, g, b) => {
    return check(r, g, b, 106, 132, 165);
  },

  heart: (r, g, b) => {
    return check(r, g, b, 238, 106, 190);
  }
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

function sample_kernel() {
  const delta_1 = Math.round(orb_width / 5);
  const delta_2 = delta_1 + 2;
  return [
    {
      x: 0,
      y: 0,
    },
    {
      x: -delta_1,
      y: delta_1,
    },
    {
      x: delta_1,
      y: delta_1,
    },
    {
      x: -delta_2,
      y: delta_2,
    },
    {
      x: delta_2 + 1,
      y: delta_2 - 1,
    },
  ];
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
gl.clearColor(0.0, 0.0, 0.0, 1.0);
let pixels = null;

function toggle_filter() {
  filter_enabled = !filter_enabled;
  render();
}

function render(displayReticle = true) {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, back_width, back_height);

  if (backdrop) {
    if (filter_enabled) {
      filtered_backdrop(0, 0);
    } else {
      backdrop(0, 0);
    }

    if (!pixels) {
      // filtered_backdrop(0, 0);
      pixels = readRaster();
      // backdrop(0, 0);
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

function jitter(x, y) {
  const kernel = sample_kernel();
  const points = [];
  kernel.forEach(({ x: dx, y: dy }) => {
    points.push({
      x: x + dx,
      y: y + dy,
    });
  });
  for (let i = 0; i !== points.length; i += 1) {
    const x = points[i].x;
    points[i].x = Math.max(Math.min(x, back_width - 1), 0);
    const y = points[i].y;
    points[i].y = Math.max(Math.min(y, back_height - 1), 0);
  }
  return points;
}

function sample_colors() {
  console.log(target_x, target_y);
  const { r, g, b } = sampleAt(target_x, target_y);
  console.log(r, g, b);
  setPreviewColor(r, g, b);
}

function read_color() {
  const { r, g, b } = pixelAt(target_x, back_height - target_y);
  console.log(r, g, b, luminance(r, g, b));
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
  };
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
    const error =
          Math.pow(v.r - r, 2) +
          Math.pow(v.g - g, 2) +
          Math.pow(v.b - b, 2);
    if (error < min_error) {
      min_error = error;
      result = key;
    }
  });

  return {
    result,
    error: min_error,
  };
}

function histogram(x, y) {
  const counts = {};
  Object.keys(types).forEach((type) => {
    counts[type] = 0;
  });

  for (let i = x - 15; i < x + 15; i += 1) {
    for (let j = y - 15; j < y + 15; j += 1) {
      const { r, g, b } = pixelAt(i, back_height - j);
      Object.keys(types).forEach((type) => {
        if (types[type](r, g, b)) {
          counts[type] += 1;
        }
      });
    }
  }
  let max = 0;
  let result = null;
  Object.keys(counts).forEach((type) => {
    if (counts[type] > max) {
      max = counts[type];
      result = type;
    }
  });
  return {
    result,
    count: max,
  };
}

function scan() {
  let x_0 = Math.floor(orb_width / 2);
  let y_0 = back_height - x_0;

  let seed_max = 0;
  let offset = 0;
  for (let i = -10; i !== 10; i += 1) {
    const { result, count } = histogram(x_0, y_0 + i);
    if (seed_max < count) {
      seed_max = count;
      offset = i;
    }
  }

  y_0 = y_0 + offset - 4 * orb_width;
  console.log('starting at', y_0, seed_max, offset);

  const results = [];
  for (let i = 0; i !== 5; i += 1) {
    for (let j = 0; j !== 6; j += 1) {
      const x = orb_width * j + x_0;
      const y = orb_width * i + y_0;

      const { result } = histogram(x, y);

      results.push(result);
    }
  }
  console.log(results);
}

function handleFile() {
  const file = document.getElementById("input").files[0];
  if (!file) {
    return;
  }

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

  backdrop = initImage(sampleImage, back_width, back_height);
  filtered_backdrop = initImage(sampleImage, back_width, back_height, sample_framebuffer, true);

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
function initImage(image, width, height, fb = null, normalize = false) {
  const vertexShaderSource = document.getElementById('2d-vertex-shader').text;
  const fragmentShaderSource = document.getElementById(normalize ? '2d-fragment-shader-normalize' : '2d-fragment-shader').text;

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
  let luminance = null;
  if (normalize) {
    luminance = gl.getUniformLocation(program, "u_lum");
  }

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

    if (normalize) {
      gl.uniform1f(luminance, reference_luminance);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}
