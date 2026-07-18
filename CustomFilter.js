// ----- Custom Filter Script for Lens Studio -----
// @input Component.PostEffectVisual postEffect
// @input float brightness = 0.0 {"widget":"slider", "min":-1.0, "max":1.0, "step":0.01}
// @input float contrast = 1.0 {"widget":"slider", "min":0.0, "max":3.0, "step":0.01}
// @input vec3 tintColor = { "widget":"color" }

// Validate inputs
if (!script.postEffect) {
    print("ERROR: Please assign a PostEffectVisual component in the Inspector.");
    return;
}

// Apply filter settings
function applyFilter() {
    // Brightness
    script.postEffect.mainPass.brightness = script.brightness;

    // Contrast
    script.postEffect.mainPass.contrast = script.contrast;

    // Tint color
    script.postEffect.mainPass.baseColor = new vec4(script.tintColor.x, script.tintColor.y, script.tintColor.z, 1.0);
}

// Run once at start
applyFilter();

// Optional: Update in real-time if you tweak sliders in Preview
script.createEvent("UpdateEvent").bind(applyFilter);
