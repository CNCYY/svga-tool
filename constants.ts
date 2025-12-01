

// SVGA 2.0 Protobuf JSON Descriptor
// Aligned with the official SVGA-Format definition (https://github.com/svga/SVGA-Format/blob/master/svga.proto)
// This fixes "invalid wire type" errors caused by field ID mismatches between Legacy and Official formats.
export const SVGA_PROTO_JSON = {
  nested: {
    com: {
      nested: {
        opensource: {
          nested: {
            svga: {
              nested: {
                Layout: {
                  fields: {
                    x: { type: "float", id: 1 },
                    y: { type: "float", id: 2 },
                    width: { type: "float", id: 3 },
                    height: { type: "float", id: 4 },
                  },
                },
                Transform: {
                  fields: {
                    a: { type: "float", id: 1 },
                    b: { type: "float", id: 2 },
                    c: { type: "float", id: 3 },
                    d: { type: "float", id: 4 },
                    tx: { type: "float", id: 5 },
                    ty: { type: "float", id: 6 },
                  },
                },
                ShapeArgs: {
                  fields: {
                    d: { type: "string", id: 1 },
                  },
                },
                RectArgs: {
                  fields: {
                    x: { type: "float", id: 1 },
                    y: { type: "float", id: 2 },
                    width: { type: "float", id: 3 },
                    height: { type: "float", id: 4 },
                    cornerRadius: { type: "float", id: 5 },
                  },
                },
                EllipseArgs: {
                  fields: {
                    x: { type: "float", id: 1 },
                    y: { type: "float", id: 2 },
                    radiusX: { type: "float", id: 3 },
                    radiusY: { type: "float", id: 4 },
                  },
                },
                ShapeStyle: {
                  fields: {
                    fill: { type: "RGBAColor", id: 1 },
                    stroke: { type: "RGBAColor", id: 2 },
                    strokeWidth: { type: "float", id: 3 },
                    lineCap: { type: "LineCap", id: 4 },
                    lineJoin: { type: "LineJoin", id: 5 },
                    miterLimit: { type: "float", id: 6 },
                    // CRITICAL FIX: Removed { packed: true }
                    // Native mobile parsers often fail to read packed repeated primitives.
                    // Using default (unpacked) encoding ensures compatibility with iOS/Android/Flutter parsers.
                    lineDash: { 
                        rule: "repeated", 
                        type: "float", 
                        id: 7
                    },
                  },
                  nested: {
                    RGBAColor: {
                      fields: {
                        r: { type: "float", id: 1 },
                        g: { type: "float", id: 2 },
                        b: { type: "float", id: 3 },
                        a: { type: "float", id: 4 },
                      },
                    },
                    LineCap: {
                      values: {
                        LineCap_BUTT: 0,
                        LineCap_ROUND: 1,
                        LineCap_SQUARE: 2,
                      },
                    },
                    LineJoin: {
                      values: {
                        LineJoin_MITER: 0,
                        LineJoin_ROUND: 1,
                        LineJoin_BEVEL: 2,
                      },
                    },
                  },
                },
                ShapeEntity: {
                  fields: {
                    type: { type: "ShapeType", id: 1 },
                    // args oneof fields mapped as optional
                    shape: { type: "ShapeArgs", id: 2 },
                    rect: { type: "RectArgs", id: 3 },
                    ellipse: { type: "EllipseArgs", id: 4 },
                    
                    // Official Spec uses 10 & 11. 
                    // Legacy files might use 3 & 4 (conflict with Rect/Ellipse), 
                    // but we prioritize Official spec to fix common crashes.
                    styles: { type: "ShapeStyle", id: 10 },
                    transform: { type: "Transform", id: 11 },
                  },
                  nested: {
                    ShapeType: {
                      values: {
                        SHAPE: 0,
                        RECT: 1,
                        ELLIPSE: 2,
                        KEEP: 3,
                      },
                    },
                  },
                },
                FrameEntity: {
                  fields: {
                    alpha: { type: "float", id: 1 },
                    layout: { type: "Layout", id: 2 },
                    transform: { type: "Transform", id: 3 },
                    clipPath: { type: "string", id: 4 },
                    shapes: { rule: "repeated", type: "ShapeEntity", id: 5 },
                  },
                },
                SpriteEntity: {
                  fields: {
                    imageKey: { type: "string", id: 1 },
                    frames: { rule: "repeated", type: "FrameEntity", id: 2 },
                    matteKey: { type: "string", id: 3 },
                  },
                },
                AudioEntity: {
                    fields: {
                        audioKey: { type: "string", id: 1 },
                        startFrame: { type: "int32", id: 2 },
                        endFrame: { type: "int32", id: 3 },
                        startTime: { type: "int32", id: 4 },
                        totalTime: { type: "int32", id: 5 },
                    }
                },
                MovieParams: {
                  fields: {
                    viewBoxWidth: { type: "float", id: 1 },
                    viewBoxHeight: { type: "float", id: 2 },
                    fps: { type: "int32", id: 3 },
                    frames: { type: "int32", id: 4 },
                  },
                },
                MovieEntity: {
                  fields: {
                    version: { type: "string", id: 1 },
                    params: { type: "MovieParams", id: 2 },
                    // Official Spec Order: Images=3, Sprites=4, Audios=5
                    images: {
                      keyType: "string",
                      type: "bytes",
                      id: 3, 
                    },
                    sprites: { rule: "repeated", type: "SpriteEntity", id: 4 },
                    audios: { rule: "repeated", type: "AudioEntity", id: 5 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};