const specimen_canvas = document.getElementById("specimen");
const preview_canvas = document.getElementById("preview");
let backdrop = null;
const back_width = 300;
const orb_width = Math.floor(back_width / 6);
let back_height = 0;
let preview_state = [];

const tolerance = 20;

const draw_calls = {};

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

const gl_preview = preview_canvas.getContext('webgl');
gl_preview.clearColor(0.0, 1.0, 0.0, 1.0);

const gl = specimen_canvas.getContext("webgl", {
  preserveDrawingBuffer: true,
});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
let pixels = null;

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, back_width, back_height);

  backdrop(0, 0);

  if (!pixels) {
    pixels = readRaster();
  }
}

function render_preview() {
  gl_preview.clear(gl_preview.COLOR_BUFFER_BIT);
  gl_preview.viewport(0, 0, back_width, orb_width * 5);

  let index = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i !== 5; i += 1) {
    for (let j = 0; j !== 6; j += 1) {
      draw_calls[preview_state[index]](x, y);
      x += orb_width;
      index += 1;
    }
    x = 0;
    y += orb_width;
  }
  render();
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
  preview_state = results;

  preview_canvas.width = orb_width * 6;
  preview_canvas.height = orb_width * 5;
  render_preview();
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
      scan();
    };
  };
  reader.readAsDataURL(file);
}

function init_orbs() {
  Object.keys(types).forEach((type) => {
    const image = new Image();
    image.src = `orbs/${type}.png`;
    image.onload = function () {
      draw_calls[type] = initImage(gl_preview, image, orb_width, orb_width, orb_width * 6, orb_width * 5);
    };
  });
}
init_orbs();

function handleSample(image) {
  const sampleImage = image;
  back_height = Math.floor(sampleImage.height * back_width / sampleImage.width);
  specimen_canvas.width = back_width;
  specimen_canvas.height = back_height;

  backdrop = initImage(gl, sampleImage, back_width, back_height, back_width, back_height);
}

function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);
  const success = context.getShaderParameter(shader, context.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(context.getShaderInfoLog(shader));
  context.deleteShader(shader);
  return null;
}

function createProgram(context, vertexShader, fragmentShader) {
  const program = context.createProgram();
  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);

  const success = context.getProgramParameter(program, context.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(context.getProgramInfoLog(program));
  context.deleteProgram(program);
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
function initImage(context, image, width, height, canvas_width, canvas_height) {
  const vertexShaderSource = document.getElementById('2d-vertex-shader').text;
  const fragmentShaderSource = document.getElementById('2d-fragment-shader').text;

  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource);

  const program = createProgram(context, vertexShader, fragmentShader);
  const positionLocation = context.getAttribLocation(program, "a_position");
  const texcoordLocation = context.getAttribLocation(program, "a_texCoord");

  const positionBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array(rectangle(0, 0, width, height)), context.STATIC_DRAW);

  const texcoordBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, texcoordBuffer);
  context.bufferData(context.ARRAY_BUFFER, new Float32Array(rectangle(0, 0, 1, 1)), context.STATIC_DRAW);

  const texture = context.createTexture();
  context.bindTexture(context.TEXTURE_2D, texture);

  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);

  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image);

  const resolutionLocation = context.getUniformLocation(program, "u_resolution");
  const displacement = context.getUniformLocation(program, "u_displacement");

  return (x, y) => {
    context.useProgram(program);

    context.bindTexture(context.TEXTURE_2D, texture);

    context.enableVertexAttribArray(positionLocation);
    context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
    context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

    context.enableVertexAttribArray(texcoordLocation);
    context.bindBuffer(context.ARRAY_BUFFER, texcoordBuffer);
    context.vertexAttribPointer(texcoordLocation, 2, context.FLOAT, false, 0, 0);

    context.uniform2f(resolutionLocation, canvas_width, canvas_height);

    context.uniform2f(displacement, x, y);

    context.drawArrays(context.TRIANGLES, 0, 6);
  };
}
