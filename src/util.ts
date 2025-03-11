import {
    concat,
    delay,
    endWith,
    from,
    map,
    mergeMap,
    Observable,
    of,
    scan,
    skip,
} from "rxjs";
import { Constants, INCREMENT, Note, note } from "./types";

export {
    getNoteColourPosition,
    parseCSV,
    createNoteSVG,
    createTailSVG,
    createSvgElement,
    createRngStreamFromSource,
    calculateNewMultiplier,
};

/**
 * Gets colour for note based on pitch
 * @param pitch a number that represents the pitch of a note
 * @returns an object containing the xPosition (column) and colour of the note
 */
const getNoteColourPosition = (
    pitch: number,
): { colour: string; xPos: string } => {
    switch (pitch % 4) {
        case 0:
            return { colour: "green", xPos: "20%" };
        case 1:
            return { colour: "red", xPos: "40%" };
        case 2:
            return { colour: "blue", xPos: "60%" };
        case 3:
            return { colour: "yellow", xPos: "80%" };
        default:
            return { colour: "yellow", xPos: "80%" };
    }
};

/**
 * parses the csv file and creates elements for each note with its information and SVG element
 * @param csv csv file
 * @returns Observable of notes
 */
function parseCSV(csv: string): Observable<note> {
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;

    const lines = csv.split("\n");
    const lines$ = from(lines);

    const allNotes$ = lines$.pipe(
        skip(1),
        map((line: string, index: number) => {
            const [user_played, instrument_name, velocity, pitch, start, end] =
                line.split(",");

            const { colour, xPos } = getNoteColourPosition(parseInt(pitch));

            return {
                id: `note-${index}`,
                user_played: user_played.toLowerCase() === "true",
                instrument_name: instrument_name,
                velocity: parseInt(velocity) / 127, // Convert velocity to a number between 0 and 1
                pitch: parseInt(pitch),
                start: parseFloat(start),
                end: parseFloat(end),
                xPos: xPos,
                yPos: 0,
                played: false,
                tailLength:
                    parseFloat(end) - parseFloat(start) >= 1
                        ? (parseFloat(end) - parseFloat(start)) *
                          INCREMENT *
                          (1000 / Constants.TICK_RATE_MS)
                        : 0,
                stopped: false,
                scored: false,
            };
        }),
        mergeMap((n: note) =>
            of(n).pipe(
                delay(Math.max((n.start - Constants.NOTE_BUFFER) * 1000, 0)),
            ),
        ),
    );

    const gameEndNote$ = of({
        id: "game-end",
        user_played: true,
        instrument_name: "",
        velocity: 0,
        pitch: 0,
        start: 0,
        end: 0,
        xPos: "0",
        yPos: 0,
        played: true,
        tailLength: 0,
    } as note).pipe(delay(Constants.NOTE_BUFFER * 1000 + 1000));

    return concat(allNotes$, gameEndNote$);
}

/**
 * creates an SVG graphics element for an individual note
 * @param svg The parent svg
 * @param note the note to be rendered
 * @returns SVG Graphics element of note
 */
const createNoteSVG = (
    svg: SVGGraphicsElement,
    note: note,
): SVGGraphicsElement => {
    return createSvgElement(svg.namespaceURI, "circle", {
        id: note.id,
        r: `${Note.RADIUS}`,
        cx: note.xPos,
        cy: `${note.yPos}`,
        style: `fill: ${getNoteColourPosition(note.pitch).colour}`,
        class: "shadow",
    }) as SVGGraphicsElement;
};

/**
 * Creates an svg graphics element for the tail of a note
 * @param svg The parent svg
 * @param note the note for which a tail is rendered
 * @returns SVG Graphics element of the tail of note
 */
const createTailSVG = (
    svg: SVGGraphicsElement,
    note: note,
): SVGGraphicsElement => {
    return createSvgElement(svg.namespaceURI, "line", {
        id: `${note.id}-tail`,
        x1: note.xPos,
        y1: `${note.yPos}`,
        x2: note.xPos,
        y2: `${note.yPos - note.tailLength}`,
        stroke: getNoteColourPosition(note.pitch).colour,
        "stroke-width": `${Note.TAIL_WIDTH}`,
    }) as SVGGraphicsElement;
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
) => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 */
abstract class RNG {
    // LCG using GCC's constants
    private static m = 0x80000000; // 2**31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * @param seed
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     * Takes hash value and scales it to the range [-1, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;
}

/**
 * Converts values in a stream to random numbers in the range [-1, 1]
 *
 * This usually would be implemented as an RxJS operator, but that is currently
 * beyond the scope of this course.
 *
 * @param source$ The source Observable, elements of this are replaced with random numbers
 * @param seed The seed for the random number generator
 */
function createRngStreamFromSource<T>(source$: Observable<T>) {
    return function createRngStream(seed: number = 0): Observable<number> {
        const randomNumberStream = source$.pipe(
            scan((acc, _) => RNG.hash(acc), seed),
            map((num) => RNG.scale(num)),
        );

        return randomNumberStream;
    };
}

/**
 * calculates multiplier based on streak
 * @param streak the current streak of consecutive notes hit
 * @returns number representing multiplier
 */
const calculateNewMultiplier = (streak: number) => {
    return 1 + 0.2 * Math.floor(streak / 10);
};
