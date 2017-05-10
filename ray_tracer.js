// Final Project
// A WebGL Ray Tracer
// Minghui Liu
// April 29 2017

class Sphere {
  constructor(center, radius, color, specular, reflectiveness) {
    this.center = center;
    this.radius = radius;
    this.color = color;
    this.specular = specular;
    this.reflectiveness = reflectiveness;
  }

  hit(origin, direction) {
    // see RTFGU page 57
    var tmin;
    var temp = vec3.sub(vec3.create(), origin, this.center);
    var a = vec3.dot(direction, direction);
    var b = 2.0 * vec3.dot(temp, direction);
    var c = vec3.dot(temp, temp) - this.radius * this.radius;
    var disc = b * b - 4.0 * a * c;     // discriminant

    if (disc < 0) {
      return false;
    } else {
      var e = Math.sqrt(disc);
      var denom = 2.0 * a;

      var t = (-b - e) / denom;         // smaller root
      if (t > kEpsilon) {
        tmin = t;
        // var normal = vec3.scaleAndAdd(vec3.create(), temp, direction, t);
        var local_hit_point = vec3.scaleAndAdd(vec3.create(), origin, direction, t);
        var normal = vec3.sub(vec3.create(), local_hit_point, this.center);
        return {
          tmin: tmin,
          normal: normal,
          local_hit_point: local_hit_point
        };
      }

      var t = (-b + e) / denom;         // larger root
      if (t > kEpsilon) {
        tmin = t;
        // var normal = vec3.scaleAndAdd(vec3.create(), temp, direction, t);
        var local_hit_point = vec3.scaleAndAdd(vec3.create(), origin, direction, t);
        var normal = vec3.sub(vec3.create(), local_hit_point, this.center);
        return {
          tmin: tmin,
          normal: normal,
          local_hit_point: local_hit_point
        };
      }
    }

    return false;
  }
}

class Plane {
  constructor(point, normal, color, specular, reflectiveness) {
    this.point = point;
    this.normal = normal;
    this.color = color;
    this.specular = specular;
    this.reflectiveness = reflectiveness;
  }

  hit(origin, direction) {
    var tmin;
    var t = vec3.dot(vec3.sub(vec3.create(), this.point, origin), this.normal) / 
            vec3.dot(direction, this.normal);
    if (t > kEpsilon) {
      var tmin = t;
      var local_hit_point = vec3.scaleAndAdd(vec3.create(), origin, direction, t);
      return {
        tmin: tmin,
        normal: this.normal,
        local_hit_point: local_hit_point
      }
    }
    return false;
  }
}

var objects = [];
var lights = [];

var pixel_size = 0.5;
var kEpsilon = 0.01;
var ambient_light = 2;
var camera_pos = vec3.fromValues(0, 1, 0);
var fov = 90;     // field of vision in degrees
var PI = 3.141592653589793238462643383279;
var recursion_depth = 4;


// lights
var light1 = {
  intensity: 8,
  position: vec3.fromValues(2, 2, 0)
};
var light2 = {
  intensity: 8,
  position: vec3.fromValues(0, 0, 10)
};
// objects
// red sphere
var sphere1 = new Sphere(vec3.fromValues(-1, 0, 6), 1, vec3.fromValues(9, 0, 0), 600, 2);
// blue sphere
var sphere2 = new Sphere(vec3.fromValues(2, 1, 8), 1, vec3.fromValues(0, 0, 9), 600, 5);
// green sphere
var sphere3 = new Sphere(vec3.fromValues(-3, 1, 8), 1, vec3.fromValues(0, 9, 0), 9, 4);
// yellow ground plane
var plane1 = new Plane(vec3.fromValues(0, -1, 0), vec3.fromValues(0, 1, 0), vec3.fromValues(9, 9, 0), 600, 0);
// dark grey mirror plane
var plane2 = new Plane(vec3.fromValues(0, 0, 20), vec3.fromValues(0, 0, -1), vec3.fromValues(2, 2, 2), 600, 5);

function main() {
  objects.push(sphere1);
  objects.push(sphere2);
  objects.push(sphere3);
  objects.push(plane1);
  objects.push(plane2);
  lights.push(light1);

  render();
}

function render() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('canvas');
  // get 2d context
  var context2d = canvas.getContext("2d");
  // retrieve image data
  var image_data = context2d.getImageData(0, 0, canvas.width, canvas.height);
  // raw pixel color values
  var raw_data = image_data.data;

  // loop through each pixel
  for (var r = 0; r < canvas.height; r++) {
    for (var c = 0; c < canvas.width; c++) {
      // calculate center of pixel 
      var y = ((canvas.height / 2) - r) / canvas.width;
      var x = (c - (canvas.width / 2)) / canvas.height;

      // emit a ray from center of this pixel, direction is z
      var direction = vec3.fromValues(x, y, 1);
      var color = trace_ray(camera_pos, direction, kEpsilon, canvas.width, /* recursion depth */recursion_depth);
      
      // assign color to raw_data
      assign_color(raw_data, r, c, canvas.width, color);
    }
  }

  // write color data to canvas
  context2d.putImageData(image_data, 0, 0);
}


function assign_color(raw_data, r, c, width, color) {
  raw_data[r*width*4+c*4]   = color[0];     // R
  raw_data[r*width*4+c*4+1] = color[1];     // G
  raw_data[r*width*4+c*4+2] = color[2];     // B
  raw_data[r*width*4+c*4+3] = 255;          // Alpha: default to 255
}

function trace_ray(origin, direction, t_min, t_max, depth) {
  // find nearest hit, return black color if no hit
  var shade_rec = closest_intersection(origin, direction, t_min, t_max);
  // if no intersection, return background color
  if (!shade_rec)
    return vec3.fromValues(0, 0, 0);   // return black

  // get normal
  var normal = shade_rec.normal;
  // square length of normal vector
  var n = vec3.dot(normal, normal);

  // start with ambient light
  var light_intensity = ambient_light;

  // for each light
  for (var i = 0; i < lights.length; i++) {
    // vector from intersection to light
    var intersection_to_light = vec3.sub(vec3.create(), lights[i].position, shade_rec.local_hit_point);
    // facing ratio = normal dot light
    var facing_ratio = vec3.dot(normal, intersection_to_light);
    // shoot a shadow ray
    // [t_min, t_max] = [eps, 1] 
    // eps: to avoid self shadow
    // 1:   to stop at the light itself and not go beyond
    var shadow_rec = closest_intersection(shade_rec.local_hit_point, intersection_to_light, kEpsilon, 1);

    // if no object between light and hitpoint (not in shadow of something)
    if (!shadow_rec) {
      // calculate diffuse light
      var diffuse = facing_ratio / Math.sqrt(vec3.dot(intersection_to_light, intersection_to_light) * n);
      // specular component of object
      var specular_comp = objects[shade_rec.idx].specular;
      // TODO: use view dot reflection
      // r = -l + 2(n * l)n
      // m = -r
      var M = vec3.scaleAndAdd(vec3.create(), intersection_to_light, normal, -2*facing_ratio/n);
      // calculate specular light
      var specular = Math.max(0, Math.pow(vec3.dot(M, direction) / Math.sqrt(vec3.dot(M, M) * vec3.dot(direction, direction)), specular_comp));

      light_intensity += lights[i].intensity * (diffuse + specular);
    }
  }

  // compute the color channel multiplied by the light intensity
  var local_color = vec3.scale(vec3.create(), objects[shade_rec.idx].color, light_intensity*2.8);

  // recursion
  if (depth > 0) {
    // reflection direction
    var reflection = vec3.scaleAndAdd(vec3.create(), direction, normal, -2*vec3.dot(normal, direction)/n);
    // recursively shoot a reflection ray
    var recur_color = trace_ray(shade_rec.local_hit_point, reflection, kEpsilon, 600, depth-1);
    // reflectiveness property of object
    var reflectiveness = objects[shade_rec.idx].reflectiveness / 9;

    return vec3.add(vec3.create(), 
                    vec3.scale(vec3.create(), recur_color, reflectiveness),
                    vec3.scale(vec3.create(), local_color, (1 - reflectiveness)));
  }
  // if reached max depth
  return local_color;
}

function closest_intersection(origin, direction, t_min, t_max) {
  var tmin = 1000;// some large number
  var object_idx = -1;
  var shade_rec = null;
  // test all objects
  for (var i = 0; i < objects.length; i++) {
    var rec = objects[i].hit(origin, direction);
    // if within [t_min, t_max] and smaller than current tmin
    if (rec && rec.tmin > t_min && rec.tmin < t_max && rec.tmin < tmin) {
      tmin = rec.tmin;
      object_idx = i;
      shade_rec = rec;
    }
  }
  // if there is a hit
  if (shade_rec)
    shade_rec.idx = object_idx;
  // return shading record
  return shade_rec;
}

function setup_scene() {
  recursion_depth = document.getElementById("depth").value;

  var l1 = document.getElementById("light1").checked;
  var l2 = document.getElementById("light2").checked;
  var rs = document.getElementById("redsphere").checked;
  var bs = document.getElementById("bluesphere").checked;
  var gs = document.getElementById("greensphere").checked;
  var yp = document.getElementById("yellowplane").checked;
  var gp = document.getElementById("greyplane").checked;

  objects = [];
  lights = [];

  if (l1)
    lights.push(light1);
  if (l2)
    lights.push(light2);
  if (rs)
    objects.push(sphere1);
  if (bs)
    objects.push(sphere2);
  if (gs)
    objects.push(sphere3);
  if (yp)
    objects.push(plane1);
  if (gp)
    objects.push(plane2);
  
  render();
}