
// Crea un elemento con el nombre y los atributos dados y agrega todos los argumentos adicionales que obtiene como nodos secundarios, convirtiendo automáticamente cadenas en nodos de texto.
function elt(name, attributes) {
  let node = document.createElement(name);
  if (attributes) {
    for (let attr in attributes)
      if (attributes.hasOwnProperty(attr))
        node.setAttribute(attr, attributes[attr]);
  }
  for (let i = 2; i < arguments.length; i++) {
    let child = arguments[i];
    if (typeof child == "string")
      child = document.createTextNode(child);
    node.appendChild(child);
  }
  return node;
};

//  Debido a que queremos construir nuestro programa pieza por pieza, definimos un objeto llamado controles, que tendrá funciones para inicializar los diversos controles debajo de la imagen.
let controls = {}

function createPaint(parent) {
  let canvas = elt("canvas", {width: 500, height: 300 }); 
  let cx = canvas.getContext("2d");
  let toolbar = elt("div", {class: "toolbar"});

  for (let name in controls)
    toolbar.appendChild(controls[name](cx));

  let panel = elt("div", {class: "picturepanel"}, canvas);
  parent.appendChild(elt("div", null, panel, toolbar));
};

// Este objeto asocia los nombres de las herramientas con la función que debería llamarse cuando se seleccionan y se hace clic en el lienzo. 
let tools = Object.create(null);

controls.tool = function(cx) {
  let select = elt("select");
  for (let name in tools)
    select.appendChild(elt("option", null, name));

  cx.canvas.addEventListener("mousedown", function(event) {
    if (event.which == 1) {
      const currentTool = tools[select.value]
      currentTool(event, cx);
      event.preventDefault();
    }
  });

  return elt("span", null, "Tool: ", select);
};

// Las propiedades clientX y clientY en los eventos del mouse también son relativas a esta esquina, por lo que podemos restarles la esquina superior izquierda del lienzo para obtener una posición relativa a esa esquina.
function relativePos(event, element) {
  let rect = element.getBoundingClientRect();
  return {x: Math.floor(event.clientX - rect.left),
          y: Math.floor(event.clientY - rect.top)};
};

// La función trackDrag se encarga de registrar y anular el registro de eventos para tales situaciones.
function trackDrag(onMove, onEnd) {
  function end(event) {
    removeEventListener("mousemove", onMove);
    removeEventListener("mouseup", end);
    if (onEnd)
      onEnd(event);
  }
  addEventListener("mousemove", onMove);
  addEventListener("mouseup", end);
};

// Cualquiera de los argumentos puede omitirse cuando no es necesario. La herramienta de línea usa estos dos ayudantes para hacer el dibujo real.
tools.Line = function(event, cx, onEnd) {
  cx.lineCap = "round";

  let pos = relativePos(event, cx.canvas);

  trackDrag(function(event) {
    cx.beginPath();
    cx.moveTo(pos.x, pos.y);
    pos = relativePos(event, cx.canvas);
    cx.lineTo(pos.x, pos.y);
    cx.stroke();
  }), onEnd;
};

// El argumento está ahí para permitirnos implementar la herramienta de borrado en la parte superior de la herramienta de línea con muy poco código adicional.
tools.Erase = function(event, cx) {
  cx.globalCompositeOperation = "destination-out";
  tools.Line(event, cx, function() {
    cx.globalCompositeOperation = "source-over";
  });
};

// COLOR Y TAMAñO DEL PINCEL

controls.color = function(cx) {
  let input = elt("input", {type: "color"});
  input.addEventListener("change", function() {
    cx.fillStyle = input.value;
    cx.strokeStyle = input.value;
  });
  return elt("span", null, "Color: ", input);
};

// El campo para configurar el tamaño del pincel funciona de manera similar.

controls.brushSize = function(cx) {
  let select = elt("select");
  let sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
  sizes.forEach(function(size) {
    select.appendChild(elt("option", {value: size},
                           size + " pixels"));
  });
  select.addEventListener("change", function() {
    cx.lineWidth = select.value;
  });
  return elt("span", null, "Brush size: ", select);
};

// En cambio, manipulamos el enlace para actualizar su atributo href cada vez que se enfoca con el teclado o se mueve el mouse sobre él.

controls.save = function(cx) {
  let link = elt("a", {href: "/"}, "Save");
  function update() {
    try {
      link.href = cx.canvas.toDataURL();
    } catch (e) {
      if (e instanceof SecurityError)
        link.href = "javascript:alert(" +
          JSON.stringify("Can't save: " + e.toString()) + ")";
      else
        throw e;
    }
  }
  link.addEventListener("mouseover", update);
  link.addEventListener("focus", update);
  return link;
};

// Necesitaremos la siguiente función auxiliar, que intenta cargar un archivo de imagen desde una URL y reemplazar el contenido del lienzo con ella:

function loadImageURL(cx, url) {
  let image = document.createElement("img");
  image.addEventListener("load", function() {
    let color = cx.fillStyle, size = cx.lineWidth;
    cx.canvas.width = image.width;
    cx.canvas.height = image.height;
    cx.drawImage(image, 0, 0);
    cx.fillStyle = color;
    cx.strokeStyle = color;
    cx.lineWidth = size;
  });
  image.src = url;
};

// Cargamos el archivo que el usuario eligió como URL de datos y lo pasamos a loadImageURL para colocarlo en el lienzo.

controls.openFile = function(cx) {
  let input = elt("input", {type: "file"});
  input.addEventListener("change", function() {
    if (input.files.length == 0) return;
    let reader = new FileReader();
    reader.addEventListener("load", function() {
      loadImageURL(cx, reader.result);
    });
    reader.readAsDataURL(input.files[0]);
  });
  return elt("div", null, "Open file: ", input);
};


// Ajustaremos el campo en un formulario y responderemos cuando se envíe el formulario, ya sea porque el usuario presionó Entrar o porque hizo clic en el botón de carga.

controls.openURL = function(cx) {
  let input = elt("input", {type: "text"});
  let form = elt("form", null,
                 "Open URL: ", input,
                 elt("button", {type: "submit"}, "load"));
  form.addEventListener("submit", function(event) {
    event.preventDefault();
    loadImageURL(cx, input.value);
  });
  return form;
};

// Podemos agregar fácilmente una herramienta de texto que utiliza el aviso para preguntarle al usuario qué cadena debe dibujar.

tools.Text = function(event, cx) {
  let text = prompt("Text:", "");
  if (text) {
    let pos = relativePos(event, cx.canvas);
    cx.font = Math.max(7, cx.lineWidth) + "px sans-serif";
    cx.fillText(text, pos.x, pos.y);
  }
};

// Este dibuja puntos en ubicaciones aleatorias debajo del pincel siempre que se mantenga presionado el mouse, creando moteado más denso o menos denso en función de lo rápido o lento que se mueve el mouse.

tools.Spray = function(event, cx) {
  let radius = cx.lineWidth / 2;
  let area = radius * radius * Math.PI;
  let dotsPerTick = Math.ceil(area / 30);

  let currentPos = relativePos(event, cx.canvas);
  let spray = setInterval(function() {
    for (let i = 0; i < dotsPerTick; i++) {
      let offset = randomPointInRadius(radius);
      cx.fillRect(currentPos.x + offset.x,
                  currentPos.y + offset.y, 1, 1);
    }
  }, 25);
  trackDrag(function(event) {
    currentPos = relativePos(event, cx.canvas);
  }, function() {
    clearInterval(spray);
  });
};
// Para encontrar una posición aleatoria debajo del pincel, se utiliza la función randomPointInRadius.

function randomPointInRadius(radius) {
  for (;;) {
    var x = Math.random() * 2 - 1;
    var y = Math.random() * 2 - 1;
    if (x * x + y * y <= 1)
      return {x: x * radius, y: y * radius};
  }
};




