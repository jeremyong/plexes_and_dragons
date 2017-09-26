const specimen_canvas = document.getElementById("specimen");
const report_div = document.getElementById('report');
let back_width = 300;
let orb_width = Math.floor(back_width / orbs_width);
let window_size = 20;
let back_height = 0;

const gl = specimen_canvas.getContext("webgl", {
  preserveDrawingBuffer: true,
});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
let pixels = null;

function disable_submit() {
  document.getElementById('submit').setAttribute('disabled', '');
}

function enable_submit() {
  document.getElementById('submit').removeAttribute('disabled');
}

function verify() {
  if (!preview_state || preview_state.length < orbs_height * orbs_width) {
    report_div.innerHTML = 'Please supply an board screenshot to scan';
    disable_submit();
    return false;
  }

  for (let i = 0; i !== preview_state.length; i += 1) {
    if (preview_state[i] === null) {
      report_div.innerHTML = 'We encountered a few orbs we could not identify. Have you selected the correct board type?';
      disable_submit();
      return false;
    }
  }

  enable_submit();
  return true;
}

function submit_board() {
  if (!preview_state || preview_state.length === 0) {
    report_div.innerHTML = 'Please supply an board screenshot to scan';
    return;
  }

  let param = preview_state[0];
  if (param === null) {
    report_div.innerHTML = 'We encountered a few orbs we could not identify. Have you selected the correct board type?';
    return;
  }
  for (let i = 1; i !== preview_state.length; i += 1) {
    param += ',';
    if (preview_state[i] === null) {
      report_div.innerHTML = 'We encountered a few orbs we could not identify. Have you selected the correct board type?';
      return;
    }
    param += preview_state[i];
  }
  let path = '';
  if (window.location.host === 'www.jeremyong.com') {
    path = 'plexes_and_dragons/public/';
  } else if (window.location.host === 'jeremy16.gitlab.io') {
    path = 'plexes_and_dragons';
  }
  const url = `${window.location.protocol}//${window.location.host}/${path}board.html?board=${param}&orbs_height=${orbs_height}&orbs_width=${orbs_width}`;
  console.log(url);
  if (window.EmbedsAPI) {
    window.EmbedsAPI.Static.addAttachment(url);
  }
  return false;
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0, 0, back_width, back_height);

  draw_calls.backdrop(0, 0);

  if (!pixels) {
    pixels = readRaster();
    scan();
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

  for (let i = x - window_size; i < x + window_size; i += 1) {
    for (let j = y - window_size; j < y + window_size; j += 1) {
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
  if (!pixels) {
    return;
  }

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

  y_0 = y_0 + offset - (orbs_height - 1) * orb_width;
  // console.log('starting at', y_0, seed_max, offset);

  let debug = '';

  const results = [];
  for (let i = 0; i !== orbs_height; i += 1) {
    for (let j = 0; j !== orbs_width; j += 1) {
      const x = orb_width * j + x_0;
      const y = orb_width * i + y_0;

      const { result } = histogram(x, y);
      debug += result;
      debug += ' ';

      results.push(result);
    }
    debug += '\n';
  }
  // console.log(results);
  preview_state = results;
  verify();

  const log = document.getElementById('log');
  if (log) {
    log.innerHTML = debug;
  }

  preview_canvas.width = orb_width * orbs_width;
  preview_canvas.height = orb_width * orbs_height;
  render_preview();
}

function change_type(type) {
  let changed = false;
  if (type === 0) {
    if (orbs_width !== 5) {
      orbs_width = 5;
      orbs_height = 4;
      changed = true;
    }
  } else if (type === 1) {
    if (orbs_width !== 6) {
      orbs_width = 6;
      orbs_height = 5;
      changed = true;
    }
  } else {
    if (orbs_width !== 7) {
      orbs_width = 7;
      orbs_height = 6;
      changed = true;
    }
  }

  if (changed) {
    orb_width = Math.floor(back_width / orbs_width);
    window_size = Math.floor(0.4 * orb_width);
    init_orbs();
    scan();
  }
}

const tolerance = 15;

function check(r, g, b, r1, g1, b1) {
  return Math.abs(r - r1) < tolerance
    && Math.abs(g - g1) < tolerance
    && Math.abs(b - b1) < tolerance;
}

const ref_colors = {
  light: [ 240, 250, 110 ],
  dark: [ 109, 80, 150 ],
  fire: [ 233, 68, 50 ],
  wood: [ 94, 152, 111 ],
  water: [ 106, 132, 165 ],
  heart: [ 238, 106, 190 ],
  jammer: [ 8, 25, 52 ],
  poison: [ 255, 255, 255 ],
};

const types = {
  light: (r, g, b) => {
    return check(r, g, b, ...ref_colors.light) ||
      check(r, g, b, 216, 181, 79);
  },

  dark: (r, g, b) => {
    return check(r, g, b, ...ref_colors.dark) ||
      check(r, g, b, 53, 16, 109) ||
      check(r, g, b, 131, 46, 174);
  },

  fire: (r, g, b) => {
    return check(r, g, b, ...ref_colors.fire) ||
      check(r, g, b, 255, 199, 162);
  },

  wood: (r, g, b) => {
    return check(r, g, b, ...ref_colors.wood) ||
      check(r, g, b, 68, 211, 106);
  },

  water: (r, g, b) => {
    return check(r, g, b, ...ref_colors.water) ||
      check(r, g, b, 62, 173, 252);
  },

  heart: (r, g, b) => {
    return check(r, g, b, ...ref_colors.heart) ||
      check(r, g, b, 255, 94, 189);
  },

  jammer: (r, g, b) => {
    return false;
    return check(r, g, b, ...ref_colors.jammer);
  },

  poison: (r, g, b) => {
    return false;
    return check(r, g, b, ...ref_colors.poison);
  }
};

function handleFile() {
  const file = document.getElementById("screenshot").files[0];
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

function handleSample(image) {
  const sampleImage = image;
  back_height = Math.floor(sampleImage.height * back_width / sampleImage.width);
  specimen_canvas.width = back_width;
  specimen_canvas.height = back_height;

  draw_calls.backdrop = initImage(gl, sampleImage, back_width, back_height, back_width, back_height);
}
