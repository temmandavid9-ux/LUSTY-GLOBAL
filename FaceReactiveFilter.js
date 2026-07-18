// ----- Face-Reactive Filter Script for Lens Studio -----
// @input Component.PostEffectVisual postEffect
// @input Component.Head headTrackingComponent

// Base default settings (Dormant State)
var DEFAULT_BRIGHTNESS = 0.0;
var DEFAULT_CONTRAST = 1.0;
var DEFAULT_TINT = new vec4(1.0, 1.0, 1.0, 1.0); // Clear / No Tint

// Active Filter settings (Triggered Face State)
var ACTIVE_BRIGHTNESS = 0.25;
var ACTIVE_CONTRAST = 1.40;
var ACTIVE_TINT = new vec4(1.0, 0.2, 0.6, 1.0); // Vibrant Pink Highlight Overlay

// Validate required component attachments
if (!script.postEffect) {
    print("ERROR: Please assign a PostEffectVisual component in the Inspector.");
    return;
}
if (!script.headTrackingComponent) {
    print("ERROR: Please assign a Head tracking component to track target presence.");
    return;
}

// Evaluation loop execution mapping
function updateFilterState() {
    // Check if a face is actively detected in the current camera frame matrix
    if (script.headTrackingComponent.isTracking()) {
        // Target face found: Apply active aesthetic boost
        script.postEffect.mainPass.brightness = ACTIVE_BRIGHTNESS;
        script.postEffect.mainPass.contrast = ACTIVE_CONTRAST;
        script.postEffect.mainPass.baseColor = ACTIVE_TINT;
    } else {
        // No faces present: Revert instantly to normal camera defaults
        script.postEffect.mainPass.brightness = DEFAULT_BRIGHTNESS;
        script.postEffect.mainPass.contrast = DEFAULT_CONTRAST;
        script.postEffect.mainPass.baseColor = DEFAULT_TINT;
    }
}

// Bind the evaluation loop to execute on every single frame update pass
script.createEvent("UpdateEvent").bind(updateFilterState);
