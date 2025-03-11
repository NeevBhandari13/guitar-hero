/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    from,
    fromEvent,
    interval,
    merge,
    Observable,
    of,
    zip,
    Subject,
} from "rxjs";
import {
    map,
    filter,
    scan,
    mergeMap,
    delay,
    startWith,
    takeUntil,
} from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { Key, State, Constants, Viewport, Note, note } from "./types";
import {
    initialState,
    KeyPress,
    KeyRelease,
    NewNote,
    reduceState,
    Tick,
} from "./state";
import {
    createNoteSVG,
    createRngStreamFromSource,
    createSvgElement,
    createTailSVG,
    getNoteColourPosition,
    parseCSV,
} from "./util";

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");

/**
 * This function is called on page load and stores all the main game logic
 * @param csvContents reference to a CSV file containing the notes for the song to be played
 * @param samples sounds that will be played corresponding to different instruments
 */
export function main(
    csvContents: string,
    samples: { [key: string]: Tone.Sampler },
) {
    // Canvas elements
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;

    const preview = document.querySelector(
        "#svgPreview",
    ) as SVGGraphicsElement & HTMLElement;
    const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
        HTMLElement;

    svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
    svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

    // Text fields
    const multiplier = document.querySelector("#multiplierText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;
    const missedText = document.querySelector("#missedText") as HTMLElement;
    const streakText = document.querySelector("#streakText") as HTMLElement;
    const saveStreakText = document.querySelector(
        "#saveStreakText",
    ) as HTMLElement;

    /** User input */

    const keyDown$ = fromEvent<KeyboardEvent>(document, "keydown");

    const keyDown = (keyCode: Key) =>
        keyDown$.pipe(
            filter(({ code }) => code === keyCode),
            filter(({ repeat }) => !repeat),
        );

    const keyUp$ = fromEvent<KeyboardEvent>(document, "keyup");

    const keyUp = (keyCode: Key) =>
        keyUp$.pipe(
            filter(({ code }) => code === keyCode),
            filter(({ repeat }) => !repeat),
        );

    // observable of all notes
    const notes$ = parseCSV(csvContents);

    // Creates observable for notes to be played by user
    const playedNotes$ = notes$.pipe(filter((n) => n.user_played === true));

    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */
    const render = (s: State) => {
        const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement;

        if (!svg) return;

        s.notes.forEach((note) => {
            let elem = document.getElementById(note.id);
            let tailElem = document.getElementById(`${note.id}-tail`);

            if (note.yPos > Constants.DISAPPEAR_POS) {
                if (elem) {
                    svg.removeChild(elem);
                }
                if (tailElem) {
                    svg.removeChild(tailElem);
                }
            } else {
                if (elem) {
                    // update position if the element exists
                    elem.setAttribute("cy", `${note.yPos}`);
                } else {
                    // Create a new element if it doesn't exist
                    const noteElement = createNoteSVG(svg, note);
                    svg.appendChild(noteElement);
                }

                // note tail
                if (note.tailLength > 0) {
                    if (tailElem) {
                        tailElem.setAttribute("x1", note.xPos);
                        tailElem.setAttribute("y1", `${note.yPos}`);
                        tailElem.setAttribute("x2", note.xPos);
                        tailElem.setAttribute(
                            "y2",
                            `${note.yPos - note.tailLength}`,
                        );
                    } else {
                        // create tail element if it doesnt exist
                        const tailElement = createTailSVG(svg, note);
                        svg.appendChild(tailElement);
                    }
                }
            }
        });

        const scoreText = document.getElementById("scoreText");
        if (scoreText) {
            scoreText.textContent = s.score.toString();
        }

        const missedText = document.getElementById("missedText");
        if (missedText) {
            missedText.textContent = s.missedNotes.toString();
        }

        const multiplierText = document.getElementById("multiplierText");
        if (multiplierText) {
            multiplierText.textContent = s.multiplier.toString();
        }

        const streakText = document.getElementById("streakText");
        if (streakText) {
            streakText.textContent = s.streak.toString();
        }

        const saveStreakText = document.getElementById("saveStreakText");
        if (saveStreakText) {
            saveStreakText.textContent = s.saveStreak ? "On" : "Off";
        }
    };

    //////////////// ACTIONS //////////////////////

    /** Determines the rate of time steps */
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(() => new Tick()));

    // Observable to add the notes to be played to the state
    const newNotes$ = playedNotes$.pipe(map((note) => new NewNote(note)));

    // Handles when keys are pressed
    const keyPress$ = merge(
        keyDown("KeyH").pipe(map(() => new KeyPress("KeyH"))), // column 1
        keyDown("KeyJ").pipe(map(() => new KeyPress("KeyJ"))), // column 2
        keyDown("KeyK").pipe(map(() => new KeyPress("KeyK"))), // column 3
        keyDown("KeyL").pipe(map(() => new KeyPress("KeyL"))), // column 4
    );

    // Handles when keys are released
    const keyRelease$ = merge(
        keyUp("KeyH").pipe(map(() => new KeyRelease("KeyH"))), // column 1
        keyUp("KeyJ").pipe(map(() => new KeyRelease("KeyJ"))), // column 2
        keyUp("KeyK").pipe(map(() => new KeyRelease("KeyK"))), // column 3
        keyUp("KeyL").pipe(map(() => new KeyRelease("KeyL"))), // column 4
    );

    // merges all action observables into one
    const action$ = merge(newNotes$, tick$, keyPress$, keyRelease$);

    //////////////// STATE OBSERVABLES //////////////////////

    // uses actions observable to apply state updates
    // need to reset playRandomNote to False after each emission
    const state$: Observable<State> = action$.pipe(
        scan((state, action) => reduceState(state, action), initialState),
    );

    //////////////// SUBSCRIPTIONS //////////////////////

    /**
     * Plays note using Tone
     * @param note note object representing note to be played
     */
    const playNote = (note: note) => {
        const noteName = Tone.Frequency(note.pitch, "midi").toNote();
        const instrument = samples[String(note.instrument_name)];

        if (note.tailLength === 0) {
            if ((note.played && !note.stopped) || !note.user_played) {
                // for notes without a tail: triggerAttackRelease
                instrument.triggerAttackRelease(
                    noteName,
                    note.end - note.start,
                    undefined,
                    note.velocity,
                );
            }
        } else {
            if (note.played && !note.stopped && !note.scored) {
                // for notes with a tail: triggerAttack when note starts playing
                instrument.triggerAttack(noteName, undefined, note.velocity);
            }
        }
    };

    /**
     * stops a note from playing, used for notes with tails
     * @param note note to be stopped
     */
    const stopNote = (note: note) => {
        const noteName = Tone.Frequency(note.pitch, "midi").toNote();
        const instrument = samples[String(note.instrument_name)];
        instrument.triggerRelease(noteName);
    };

    /**
     * Subscribes state changes to canvas for user
     */
    const subscription$ = state$.subscribe((s: State) => {
        render(s);

        s.notes.forEach((note) => {
            if (note.played) {
                playNote(note);
            }
            if (note.stopped) {
                stopNote(note);
            }
        });

        if (s.gameEnd) {
            show(gameover);
            subscription$.unsubscribe();
            playRandomNote$.unsubscribe();
        } else {
            hide(gameover);
        }
    });

    // Creates observable for notes to be played in the background
    const bgm$ = notes$
        .pipe(
            filter((n) => n.user_played === false),
            mergeMap((n: note) =>
                of(n).pipe(delay(Constants.NOTE_BUFFER * 1000)),
            ),
        )
        .subscribe((note) => playNote(note));

    // LOGIC TO PLAY RANDOM NOTE
    const randomNote$ = state$.pipe(filter((s) => s.playRandomNote));

    const rngStream = createRngStreamFromSource(randomNote$);

    const pitchStream$ = rngStream(0).pipe(
        map((randomValue) => Math.floor(((randomValue + 1) / 2) * 127)),
    );

    const durationStream$ = rngStream(0).pipe(
        map((randomValue) => (randomValue + 1) / 4),
    );

    const playRandomNote$ = zip(pitchStream$, durationStream$).subscribe(
        ([pitch, duration]) => {
            const noteName = Tone.Frequency(pitch, "midi").toNote();
            samples["piano"].triggerAttackRelease(
                noteName,
                duration,
                undefined,
                0.25,
            );
        },
    );
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    // Load in the instruments and then start your game!
    const samples = SampleLibrary.load({
        instruments: [
            "bass-electric",
            "violin",
            "piano",
            "trumpet",
            "saxophone",
            "trombone",
            "flute",
        ], // SampleLibrary.list,
        baseUrl: "samples/",
    });

    const startGame = (contents: string) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents, samples);
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        for (const instrument in samples) {
            samples[instrument].toDestination();
            samples[instrument].release = 0.5;
        }

        fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
            .then((response) => response.text())
            .then((text) => startGame(text))
            .catch((error) =>
                console.error("Error fetching the CSV file:", error),
            );
    });
}
