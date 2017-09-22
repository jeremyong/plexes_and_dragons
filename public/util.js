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
