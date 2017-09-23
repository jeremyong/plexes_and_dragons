const specimen_canvas = document.getElementById("specimen");
const back_width = 300;
const orb_width = Math.floor(back_width / 6);
let back_height = 0;

const draw_calls = {};

const gl = specimen_canvas.getContext("webgl", {
  preserveDrawingBuffer: true,
});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
let pixels = null;

function submit_board() {
  if (!preview_state || preview_state.length === 0) {
    return;
  }

  let param = preview_state[0];
  for (let i = 1; i !== preview_state.length; i += 1) {
    param += ',';
    param += preview_state[i];
  }
  const url = `${window.origin}/board.html?board=${param}`;
  console.log(url);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, back_width, back_height);

  draw_calls.backdrop(0, 0);

  if (!pixels) {
    pixels = readRaster();
  }
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

function handleSample(image) {
  const sampleImage = image;
  back_height = Math.floor(sampleImage.height * back_width / sampleImage.width);
  specimen_canvas.width = back_width;
  specimen_canvas.height = back_height;

  draw_calls.backdrop = initImage(gl, sampleImage, back_width, back_height, back_width, back_height);
}
