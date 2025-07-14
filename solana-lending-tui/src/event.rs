use std::{sync::mpsc, thread, time::Duration};
use anyhow::Result;
use crossterm::event::{self, Event as CrosstermEvent, KeyEvent, MouseEvent};

/// Terminal events.
#[derive(Debug, Clone, Copy)]
pub enum Event {
    /// Terminal tick.
    Tick,
    /// Key press.
    Key(KeyEvent),
    /// Mouse click/scroll.
    Mouse(MouseEvent),
    /// Terminal resize.
    Resize(u16, u16),
}

/// Event handler.
#[derive(Debug)]
pub struct EventHandler {
    /// Event sender channel.
    #[allow(dead_code)]
    sender: mpsc::Sender<Event>,
    /// Event receiver channel.
    receiver: mpsc::Receiver<Event>,
    /// Event handler thread.
    #[allow(dead_code)]
    handler: thread::JoinHandle<()>,
}

impl EventHandler {
    /// Constructs a new instance of [`EventHandler`].
    pub fn new(tick_rate: Duration) -> Self {
        let (sender, receiver) = mpsc::channel();
        let handler = {
            let sender = sender.clone();
            thread::spawn(move || {
                let mut last_tick = std::time::Instant::now();
                loop {
                    let timeout = tick_rate
                        .checked_sub(last_tick.elapsed())
                        .unwrap_or(Duration::from_secs(0));

                    if event::poll(timeout).expect("no events available") {
                        match event::read().expect("unable to read event") {
                            CrosstermEvent::Key(e) => {
                                if let Err(err) = sender.send(Event::Key(e)) {
                                    eprintln!("{}", err);
                                    return;
                                }
                            }
                            CrosstermEvent::Mouse(e) => {
                                if let Err(err) = sender.send(Event::Mouse(e)) {
                                    eprintln!("{}", err);
                                    return;
                                }
                            }
                            CrosstermEvent::Resize(w, h) => {
                                if let Err(err) = sender.send(Event::Resize(w, h)) {
                                    eprintln!("{}", err);
                                    return;
                                }
                            }
                            _ => {}
                        }
                    }

                    if last_tick.elapsed() >= tick_rate {
                        if let Err(err) = sender.send(Event::Tick) {
                            eprintln!("{}", err);
                            return;
                        }
                        last_tick = std::time::Instant::now();
                    }
                }
            })
        };
        Self {
            sender,
            receiver,
            handler,
        }
    }

    /// Receive the next event from the handler thread.
    ///
    /// This function will always block the current thread if
    /// there is no data available and it's possible for more data to be sent.
    pub fn next(&self) -> Result<Event> {
        self.receiver.recv()
            .map_err(|e| AppError::Unknown(format!("Failed to receive event: {}", e)))
    }
}