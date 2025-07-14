use std::fmt::Display;
use tui_input::Input;
use crate::error::{Result, AppError};

/// Input state for text input
pub struct InputState {
    /// The input widget state
    pub input: Input,
    /// Whether the input is active
    pub active: bool,
    /// The label for the input
    pub label: String,
}

impl InputState {
    /// Create a new input state
    pub fn new(label: &str) -> Self {
        Self {
            input: Input::default(),
            active: false,
            label: label.to_string(),
        }
    }

    /// Activate the input
    pub fn activate(&mut self) {
        self.active = true;
    }

    /// Deactivate the input
    pub fn deactivate(&mut self) {
        self.active = false;
    }

    /// Toggle the active state
    pub fn toggle(&mut self) {
        self.active = !self.active;
    }

    /// Reset the input
    pub fn reset(&mut self) {
        self.input = Input::default();
        self.active = false;
    }

    /// Get the input value
    pub fn value(&self) -> &str {
        self.input.value()
    }

    /// Parse the input value as a specific type
    pub fn parse<T>(&self) -> Result<T>
    where
        T: std::str::FromStr,
        T::Err: Display,
    {
        self.input
            .value()
            .parse::<T>()
            .map_err(|e| AppError::InvalidInput(format!("Invalid input: {}", e)))
    }
}

/// Input handler for managing multiple inputs
pub struct InputHandler {
    /// The collection of inputs
    pub inputs: Vec<InputState>,
    /// The currently active input index
    pub active_index: Option<usize>,
}

impl InputHandler {
    /// Create a new input handler
    pub fn new() -> Self {
        Self {
            inputs: Vec::new(),
            active_index: None,
        }
    }

    /// Add a new input
    pub fn add_input(&mut self, label: &str) -> usize {
        let index = self.inputs.len();
        self.inputs.push(InputState::new(label));
        index
    }

    /// Get an input by index
    pub fn get(&self, index: usize) -> Option<&InputState> {
        self.inputs.get(index)
    }

    /// Get a mutable reference to an input by index
    pub fn get_mut(&mut self, index: usize) -> Option<&mut InputState> {
        self.inputs.get_mut(index)
    }

    /// Activate an input by index
    pub fn activate(&mut self, index: usize) {
        if let Some(input) = self.get_mut(index) {
            input.activate();
            self.active_index = Some(index);
        }
    }

    /// Deactivate the currently active input
    pub fn deactivate(&mut self) {
        if let Some(index) = self.active_index {
            if let Some(input) = self.get_mut(index) {
                input.deactivate();
            }
        }
        self.active_index = None;
    }

    /// Get the currently active input
    pub fn active_input(&self) -> Option<&InputState> {
        self.active_index.and_then(|index| self.get(index))
    }

    /// Get a mutable reference to the currently active input
    pub fn active_input_mut(&mut self) -> Option<&mut InputState> {
        self.active_index.and_then(move |index| self.get_mut(index))
    }

    /// Check if any input is active
    pub fn is_active(&self) -> bool {
        self.active_index.is_some()
    }

    /// Reset all inputs
    pub fn reset(&mut self) {
        for input in &mut self.inputs {
            input.reset();
        }
        self.active_index = None;
    }
}