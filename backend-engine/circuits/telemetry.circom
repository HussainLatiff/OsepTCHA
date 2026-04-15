pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";

template TelemetryCheck() {
    // Private Inputs (User's actual mathematical telemetry)
    signal input user_velocity;
    signal input user_tremor;
    
    // Public Inputs (Thresholds set by Risk Engine)
    signal input max_velocity;
    signal input min_tremor;

    // Output verification payload
    signal output is_valid;

    // Condition 1: Assert user_velocity < max_velocity
    // Using 32-bit registers since cursor movements will comfortably fit within 2^32
    component lessThan = LessThan(32);
    lessThan.in[0] <== user_velocity;
    lessThan.in[1] <== max_velocity;
    lessThan.out === 1;

    // Condition 2: Assert user_tremor > min_tremor
    component greaterThan = GreaterThan(32);
    greaterThan.in[0] <== user_tremor;
    greaterThan.in[1] <== min_tremor;
    greaterThan.out === 1;

    // Return truthy payload if both constraints resolve
    is_valid <== 1;
}

component main {public [max_velocity, min_tremor]} = TelemetryCheck();
