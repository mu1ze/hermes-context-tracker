import {
  host,
  useValue,
  useQuery,
  useQueryClient,
  Tip,
  TITLEBAR_AREAS,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from "@hermes/plugin-sdk";
import { useEffect, useId, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";

const fallbackConnection = {
  get: () => host.activeConnectionId?.() || "local",
  subscribe: () => () => {},
};
const legacyOwner = { get: () => undefined, subscribe: () => () => {} };
const activeConnection = () =>
  host.state.connectionId?.get() || host.activeConnectionId?.() || "local";
const hasOccupancy = (value) =>
  finite(value?.context_used) &&
  finite(value?.context_max) &&
  value.context_max > 0;
const finite = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const number = (value) =>
  finite(value) ? Math.round(value).toLocaleString() : "—";
const row = (label, value, key = label) =>
  jsx(
    "div",
    {
      className: "ctx-ring-row",
      children: [
        jsx("span", { className: "ctx-ring-label", children: label }),
        jsx("span", { className: "ctx-ring-value", children: value }),
      ],
    },
    key,
  );

const compactTokenCount = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function SessionTokenReadout({ input, output }) {
  const usable = finite(input) && finite(output);
  const total = usable ? input + output : 0;
  const inputShare = total > 0 ? (input / total) * 100 : 0;
  const readableCount = (label, value) =>
    finite(value)
      ? `${number(value)} ${label.toLowerCase()} tokens`
      : `${label} unavailable`;
  const exact = [
    readableCount("Input", input),
    readableCount("Output", output),
  ];
  const tip = usable
    ? `${number(input)} input · ${number(output)} output tokens`
    : exact.join(" · ");
  const metric = (label, value) =>
    jsx("span", {
      className: "ctx-ring-token-metric",
      children: [
        jsx("span", { className: "ctx-ring-label", children: label }),
        jsx("strong", {
          children:
            finite(value) && value >= 1000
              ? compactTokenCount.format(value)
              : number(value),
        }),
      ],
    });
  return jsx(Tip, {
    label: tip,
    className: "ctx-ring-tooltip ctx-ring-token-tip",
    side: "bottom",
    sideOffset: 5,
    children: jsx("div", {
      className: "ctx-ring-token-readout",
      role: "group",
      tabIndex: 0,
      "aria-label": exact.join(", "),
      children: [
        jsx("div", {
          className: "ctx-ring-token-numbers",
          "aria-hidden": true,
          children: [metric("Input", input), metric("Output", output)],
        }),
        total > 0 &&
          jsx("div", {
            className: "ctx-ring-token-split",
            "aria-hidden": true,
            style: {
              gridTemplateColumns: `minmax(0, ${inputShare}fr) minmax(0, ${100 - inputShare}fr)`,
              columnGap: input > 0 && output > 0 ? 2 : 0,
            },
            children: [
              jsx("i", { className: "ctx-ring-token-input" }),
              jsx("i", { className: "ctx-ring-token-output" }),
            ],
          }),
      ],
    }),
  });
}

/* Model icon paths adapted from Lobe Icons (9752d967494e48d8f83f2808feb2b0207bf70997).
 * https://github.com/lobehub/lobe-icons
 *
 * MIT License
 *
 * Copyright (c) 2023 LobeHub
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const modelLogos = [
  [
    "openai",
    /^(?:gpt|chatgpt|codex|o[1-9]\d*)(?:[ ._-]|$)/,
    [
      [
        "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z",
      ],
    ],
  ],
  [
    "claude",
    /^claude(?:[ ._-]|$)/,
    [
      [
        "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z",
      ],
    ],
  ],
  [
    "gemini",
    /^gemini(?:[ ._-]|$)/,
    [
      [
        "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z",
      ],
    ],
  ],
  [
    "deepseek",
    /^deepseek(?:[ ._-]|$)/,
    [
      [
        "M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z",
      ],
    ],
  ],
  [
    "qwen",
    /^(?:huihui[-_])?(?:qwen|qwq)(?:\d|[ ._-]|$)/,
    [
      [
        "M19.713 2.825h-5.907c0-.251-.066-.503-.196-.728L12.819.728A1.46 1.46 0 0 0 11.559 0h-1.58c-.52 0-1 .275-1.26.728l-2.42 4.19a1.45 1.45 0 0 0 0 1.453l.791 1.37c.26.448.74.727 1.26.727h11.36c.52 0 1-.275 1.26-.728l.79-1.37a1.45 1.45 0 0 0 0-1.451l-.79-1.37a1.46 1.46 0 0 0-1.26-.728zM.195 9.905l2.951 5.115a1.46 1.46 0 0 0-.531.531l-.791 1.37a1.45 1.45 0 0 0 0 1.452l.79 1.37c.26.448.74.727 1.26.727h4.84c.52 0 1-.275 1.26-.728l.79-1.37a1.45 1.45 0 0 0 0-1.451L5.086 7.083a1.46 1.46 0 0 0-1.26-.728h-1.58c-.52 0-1 .276-1.26.728l-.79 1.37a1.45 1.45 0 0 0 0 1.452m15.888 13.367 2.951-5.115c.217.125.469.196.728.196h1.582c.52 0 1-.275 1.26-.728l.79-1.37a1.45 1.45 0 0 0 0-1.451l-2.42-4.191a1.46 1.46 0 0 0-1.259-.728h-1.582c-.52 0-1 .276-1.259.728l-5.678 9.838a1.45 1.45 0 0 0 0 1.452l.79 1.37c.26.448.74.727 1.26.727h1.582c.52 0 1-.275 1.26-.728z",
      ],
    ],
  ],
  [
    "grok",
    /^grok(?:[ ._-]|$)/,
    [
      [
        "M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815",
      ],
    ],
  ],
  [
    "kimi",
    /^kimi(?:[ ._-]|$)/,
    [
      [
        "M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z",
      ],
      [
        "M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z",
      ],
    ],
  ],
  [
    "mistral",
    /^(?:mistral|mixtral|codestral|devstral|ministral|magistral|pixtral)(?:[ ._-]|$)/,
    [
      [
        "M3.428 3.4h3.429v3.428h3.429v3.429h-.002 3.431V6.828h3.427V3.4h3.43v13.714H24v3.429H13.714v-3.428h-3.428v-3.429h-3.43v3.428h3.43v3.429H0v-3.429h3.428V3.4zm10.286 13.715h3.428v-3.429h-3.427v3.429z",
        "evenodd",
      ],
    ],
  ],
  [
    "meta",
    /^llama(?:[ ._-]|$)/,
    [
      [
        "M6.897 4c1.915 0 3.516.932 5.43 3.376l.282-.373c.19-.246.383-.484.58-.71l.313-.35C14.588 4.788 15.792 4 17.225 4c1.273 0 2.469.557 3.491 1.516l.218.213c1.73 1.765 2.917 4.71 3.053 8.026l.011.392.002.25c0 1.501-.28 2.759-.818 3.7l-.14.23-.108.153c-.301.42-.664.758-1.086 1.009l-.265.142-.087.04a3.493 3.493 0 01-.302.118 4.117 4.117 0 01-1.33.208c-.524 0-.996-.067-1.438-.215-.614-.204-1.163-.56-1.726-1.116l-.227-.235c-.753-.812-1.534-1.976-2.493-3.586l-1.43-2.41-.544-.895-1.766 3.13-.343.592C7.597 19.156 6.227 20 4.356 20c-1.21 0-2.205-.42-2.936-1.182l-.168-.184c-.484-.573-.837-1.311-1.043-2.189l-.067-.32a8.69 8.69 0 01-.136-1.288L0 14.468c.002-.745.06-1.49.174-2.23l.1-.573c.298-1.53.828-2.958 1.536-4.157l.209-.34c1.177-1.83 2.789-3.053 4.615-3.16L6.897 4zm-.033 2.615l-.201.01c-.83.083-1.606.673-2.252 1.577l-.138.199-.01.018c-.67 1.017-1.185 2.378-1.456 3.845l-.004.022a12.591 12.591 0 00-.207 2.254l.002.188c.004.18.017.36.04.54l.043.291c.092.503.257.908.486 1.208l.117.137c.303.323.698.492 1.17.492 1.1 0 1.796-.676 3.696-3.641l2.175-3.4.454-.701-.139-.198C9.11 7.3 8.084 6.616 6.864 6.616zm10.196-.552l-.176.007c-.635.048-1.223.359-1.82.933l-.196.198c-.439.462-.887 1.064-1.367 1.807l.266.398c.18.274.362.56.55.858l.293.475 1.396 2.335.695 1.114c.583.926 1.03 1.6 1.408 2.082l.213.262c.282.326.529.54.777.673l.102.05c.227.1.457.138.718.138.176.002.35-.023.518-.073.338-.104.61-.32.813-.637l.095-.163.077-.162c.194-.459.29-1.06.29-1.785l-.006-.449c-.08-2.871-.938-5.372-2.2-6.798l-.176-.189c-.67-.683-1.444-1.074-2.27-1.074z",
      ],
    ],
  ],
  [
    "cohere",
    /^command(?:[ ._-]|$)/,
    [
      [
        "M8.128 14.099c.592 0 1.77-.033 3.398-.703 1.897-.781 5.672-2.2 8.395-3.656 1.905-1.018 2.74-2.366 2.74-4.18A4.56 4.56 0 0018.1 1H7.549A6.55 6.55 0 001 7.55c0 3.617 2.745 6.549 7.128 6.549z",
        "evenodd",
      ],
      [
        "M9.912 18.61a4.387 4.387 0 012.705-4.052l3.323-1.38c3.361-1.394 7.06 1.076 7.06 4.715a5.104 5.104 0 01-5.105 5.104l-3.597-.001a4.386 4.386 0 01-4.386-4.387z",
        "evenodd",
      ],
      [
        "M4.776 14.962A3.775 3.775 0 001 18.738v.489a3.776 3.776 0 007.551 0v-.49a3.775 3.775 0 00-3.775-3.775z",
      ],
    ],
  ],
  [
    "zai",
    /^(?:glm|codegeex)(?:\d|[ ._-]|$)/,
    [
      [
        "M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z",
      ],
    ],
  ],
  [
    "minimax",
    /^minimax(?:[ ._-]|$)/,
    [
      [
        "M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z",
      ],
    ],
  ],
  [
    "perplexity",
    /^sonar(?:[ ._-]|$)/,
    [
      [
        "M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z",
      ],
    ],
  ],
  [
    "nvidia",
    /^(?:nvidia[ _-])?nemotron(?:[ ._-]|$)/,
    [
      [
        "M10.212 8.976V7.62c.127-.01.256-.017.388-.021 3.596-.117 5.957 3.184 5.957 3.184s-2.548 3.647-5.282 3.647a3.227 3.227 0 01-1.063-.175v-4.109c1.4.174 1.681.812 2.523 2.258l1.873-1.627a4.905 4.905 0 00-3.67-1.846 6.594 6.594 0 00-.729.044m0-4.476v2.025c.13-.01.259-.019.388-.024 5.002-.174 8.261 4.226 8.261 4.226s-3.743 4.69-7.643 4.69c-.338 0-.675-.031-1.007-.092v1.25c.278.038.558.057.838.057 3.629 0 6.253-1.91 8.794-4.169.421.347 2.146 1.193 2.501 1.564-2.416 2.083-8.048 3.763-11.24 3.763-.308 0-.603-.02-.894-.048V19.5H24v-15H10.21zm0 9.756v1.068c-3.356-.616-4.287-4.21-4.287-4.21a7.173 7.173 0 014.287-2.138v1.172h-.005a3.182 3.182 0 00-2.502 1.178s.615 2.276 2.507 2.931m-5.961-3.3c1.436-1.935 3.604-3.148 5.961-3.336V6.523C5.81 6.887 2 10.723 2 10.723s2.158 6.427 8.21 7.015v-1.166C5.77 16 4.25 10.958 4.25 10.958h-.002z",
      ],
    ],
  ],
  [
    "ai21",
    /^jamba(?:[ ._-]|$)/,
    [
      [
        "M6.47 17l-.367-1.189H2.718L2.35 17H0l3.398-9.789h2.026L8.864 17H6.47zm-2.052-6.993l-1.17 4.028H5.56l-1.142-4.028zm4.707-2.796h2.23V17h-2.23V7.211zM11.955 15c.1-.483.277-.946.524-1.37.214-.359.482-.68.795-.951.32-.273.658-.52 1.013-.741.28-.168.54-.33.781-.483.222-.14.433-.296.632-.468.172-.148.317-.325.428-.525.107-.199.16-.423.157-.65 0-.392-.104-.674-.313-.846a1.176 1.176 0 00-.775-.259 1.207 1.207 0 00-.863.329c-.231.219-.347.585-.347 1.098H11.8a3.387 3.387 0 01.224-1.245c.146-.377.371-.716.66-.993.306-.29.667-.514 1.06-.657A4.04 4.04 0 0115.183 7c.42-.002.84.057 1.244.175.376.107.73.287 1.04.531.305.246.55.562.714.923.185.419.275.875.265 1.335.005.39-.084.774-.259 1.12-.167.328-.38.63-.632.894-.246.259-.517.49-.808.693-.29.2-.554.37-.789.51-.326.224-.596.417-.809.58a3.872 3.872 0 00-.51.455 1.229 1.229 0 00-.265.434 1.633 1.633 0 00-.074.517h4.078V17h-6.606a9.24 9.24 0 01.183-2zM18.8 8.93a5.05 5.05 0 001.135-.105c.25-.049.484-.156.686-.314.163-.139.28-.324.34-.532.068-.25.1-.51.095-.77H23V17h-2.243v-6.475H18.8V8.93z",
      ],
    ],
  ],
];

function ModelLabel({ model }) {
  // Identify the model family, not the gateway or billing provider. Keep
  // unknown and custom names intact instead of assigning a guessed logo.
  const family = model.trim().toLowerCase().split("/").at(-1);
  const logo = modelLogos.find(([, pattern]) => pattern.test(family));
  return jsx("div", {
    className: "ctx-ring-model",
    children: [
      logo &&
        jsx("svg", {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "currentColor",
          "aria-hidden": true,
          focusable: "false",
          "data-model-logo": logo[0],
          children: logo[2].map(([d, fillRule]) =>
            jsx("path", { d, fillRule }, d),
          ),
        }),
      jsx("span", { children: model }),
    ],
  });
}

const breakdownPreference = "contextBreakdownExpanded";

function ContextTracker({ storage }) {
  const session = useValue(host.state.focusedSessionId);
  const usage = useValue(host.state.focusedUsage);
  const busy = useValue(host.state.busy);
  const fallbackProfile = useValue(host.state.focusedSessionProfile);
  const owner = useValue(host.state.focusedSessionOwner || legacyOwner);
  const profile = owner?.profile || fallbackProfile;
  const gateway = useValue(host.state.gateway);
  const connection =
    useValue(host.state.connectionId || fallbackConnection) ||
    host.activeConnectionId?.() ||
    "local";
  const sessionConnection = owner?.connectionId || connection;
  const routed = owner !== null && sessionConnection === connection;
  const scope = JSON.stringify([
    connection,
    profile,
    session,
    sessionConnection,
    routed,
  ]);
  const [pinnedScope, setPinnedScope] = useState(null);
  const pinned = pinnedScope === scope;
  const breakdownId = useId();
  const [breakdownExpanded, setBreakdownExpanded] = useState(
    () => storage?.get(breakdownPreference, false) === true,
  );
  const toggleBreakdown = () => {
    const expanded = !breakdownExpanded;
    setBreakdownExpanded(expanded);
    storage?.set(breakdownPreference, expanded);
  };
  const query = useQuery({
    queryKey: [
      "context-tracker",
      connection,
      profile,
      session,
      busy,
      usage?.compressions,
      usage?.calls,
      usage?.model,
    ],
    enabled: Boolean(session) && routed && !busy && gateway === "open",
    queryFn: async () => {
      const result = await host.request("session.context_breakdown", {
        session_id: session,
        profile,
      });
      if (!hasOccupancy(result) && !result?.categories?.length)
        throw new Error("Context unavailable");
      return result;
    },
    staleTime: 0,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    refetchOnWindowFocus: true,
  });
  const queryClient = useQueryClient();
  const jobs = useRef(new Map());
  const [, redraw] = useState(0);
  const writeJob = (key, value) => {
    jobs.current.set(key, value);
    redraw((n) => n + 1);
  };
  const job = jobs.current.get(scope);
  const compacting = ["working", "pending", "uncertain"].includes(job?.state);
  useEffect(() => {
    setPinnedScope(null);
  }, [scope]);
  useEffect(() => {
    if (
      routed &&
      ["pending", "uncertain"].includes(job?.state) &&
      finite(usage?.compressions) &&
      usage.compressions > job.baseline
    ) {
      writeJob(scope, { state: "success", message: "Session compacted." });
      void queryClient.invalidateQueries({
        queryKey: ["context-tracker", connection, profile, session],
      });
    }
  }, [scope, usage?.compressions, job?.state, routed]);
  const compact = async () => {
    // Re-read the live scope at the gesture; never mutate a stale render's session.
    const liveSession = host.state.focusedSessionId.get();
    const liveOwner = host.state.focusedSessionOwner?.get();
    const liveProfile =
      liveOwner?.profile || host.state.focusedSessionProfile.get();
    const liveConnection = activeConnection();
    const liveSessionConnection = liveOwner?.connectionId || liveConnection;
    if (
      !liveSession ||
      !routed ||
      liveOwner === null ||
      liveSessionConnection !== liveConnection ||
      JSON.stringify([
        liveConnection,
        liveProfile,
        liveSession,
        liveSessionConnection,
        true,
      ]) !== scope ||
      host.state.busy.get() ||
      host.state.gateway.get() !== "open" ||
      ["working", "pending", "uncertain"].includes(
        jobs.current.get(scope)?.state,
      )
    )
      return;
    const baseline = host.state.focusedUsage.get()?.compressions || 0;
    writeJob(scope, {
      state: "working",
      baseline,
      message: "Compacting this session…",
    });
    try {
      // Match Desktop's native /compress deadline; do not retry a mutation.
      const result = await host.request(
        "session.compress",
        { session_id: liveSession, profile: liveProfile },
        660000,
      );
      if (
        !result ||
        result.error ||
        ["error", "failed", "rejected"].includes(result.status) ||
        (!result.summary &&
          !result.usage &&
          !result.info &&
          !Array.isArray(result.messages) &&
          !["ok", "completed", "compacted", "pending"].includes(result.status))
      )
        throw new Error(
          result?.message || "Gateway did not confirm compaction.",
        );
      if (result.status === "pending") {
        writeJob(scope, {
          state: "pending",
          baseline,
          message:
            "Compaction is still running on the gateway. Waiting for updated session usage.",
        });
      } else if (result.summary?.aborted) {
        writeJob(scope, {
          state: "error",
          message:
            result.summary.note ||
            "Compaction was aborted; the session was not compacted.",
        });
      } else {
        writeJob(scope, {
          state: "success",
          message:
            result.summary?.headline ||
            (result.summary?.noop
              ? "No compaction needed."
              : "Session compacted."),
        });
        void queryClient.invalidateQueries({
          queryKey: ["context-tracker", connection, profile, session],
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Compaction failed.";
      const uncertain =
        /timeout|timed out|deadline|disconnect|socket|connection.*closed/i.test(
          message,
        );
      writeJob(scope, {
        state: uncertain ? "uncertain" : "error",
        baseline,
        message: uncertain
          ? "Compaction could still be running after the connection or deadline ended. Check the session before retrying; no automatic retry was sent."
          : `Compaction failed: ${message}`,
      });
    }
  };
  // Never use an idle snapshot during a turn or after a gateway disconnect.
  // Streamed occupancy is the current prompt, NOT cumulative input/output.
  const detail =
    routed && !busy && gateway === "open" && !query.isFetching && !query.isError
      ? query.data
      : null;
  const source =
    gateway === "open" && routed
      ? hasOccupancy(detail)
        ? detail
        : usage
      : null;
  const known = Boolean(session) && hasOccupancy(source);
  const used = known ? source.context_used : null;
  const max = known ? source.context_max : null;
  const percent = known ? (used / max) * 100 : null;
  const fill = known ? Math.min(100, percent) : null;
  const estimated = source?.context_estimated === true;
  const categories = Array.isArray(detail?.categories)
    ? detail.categories
        .filter(
          (c) => c && finite(c.tokens) && c.tokens > 0 && (c.label || c.id),
        )
        .sort((a, b) => b.tokens - a.tokens)
    : [];
  const fullness = known
    ? `${percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% full`
    : null;
  const remaining = known
    ? used > max
      ? `${number(used - max)} tokens over`
      : `${number(max - used)} tokens left`
    : null;
  const summary = known
    ? `${estimated ? "Estimated " : ""}context: ${fullness} · ${number(used)} / ${number(max)} tokens · ${remaining}`
    : "Context usage unavailable";
  const counts = session && routed && gateway === "open" ? usage : null;
  const model = counts?.model || detail?.model;
  const contextPanel = (interactive) =>
    jsx("div", {
      className: "ctx-ring-info",
      children: [
        jsx("div", {
          className: "ctx-ring-heading",
          children: [
            jsx("strong", { children: "Context window" }),
            jsx("div", {
              className: "ctx-ring-heading-end",
              children: [
                known &&
                  jsx("span", {
                    className: "ctx-ring-value",
                    children: fullness,
                  }),
                interactive &&
                  session &&
                  jsx("button", {
                    type: "button",
                    className: "ctx-ring-disclosure",
                    "aria-label": "Context breakdown",
                    "aria-controls": breakdownId,
                    "aria-expanded": breakdownExpanded,
                    title: `${breakdownExpanded ? "Hide" : "Show"} context breakdown`,
                    onClick: toggleBreakdown,
                    children: jsx("svg", {
                      width: 14,
                      height: 14,
                      viewBox: "0 0 24 24",
                      "aria-hidden": true,
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      children: jsx("path", { d: "m9 18 6-6-6-6" }),
                    }),
                  }),
              ],
            }),
          ],
        }),
        known
          ? jsx("div", {
              className: "ctx-ring-context",
              children: [
                interactive &&
                  jsx("div", {
                    className: "ctx-ring-track",
                    "aria-hidden": "true",
                    children: jsx("div", { style: { width: `${fill}%` } }),
                  }),
                jsx("div", {
                  className: "ctx-ring-counts",
                  children: [
                    jsx("span", {
                      className: "ctx-ring-value",
                      children: number(used),
                    }),
                    ` / ${number(max)} tokens`,
                  ],
                }),
                jsx("div", {
                  className: "ctx-ring-label",
                  children: `${remaining}${estimated ? " · Estimated" : ""}`,
                }),
              ],
            })
          : jsx("div", {
              className: "ctx-ring-label",
              children: !session
                ? "No conversation selected"
                : gateway !== "open"
                  ? "Gateway disconnected"
                  : !routed
                    ? "Session gateway unavailable"
                    : "Context usage unavailable",
            }),
      ],
    });
  const sessionPanel =
    session &&
    jsx("section", {
      className: "ctx-ring-section",
      children: [
        jsx("div", {
          className: "ctx-ring-heading",
          children: jsx("strong", { children: "Session usage" }),
        }),
        jsx(SessionTokenReadout, {
          input: counts?.input,
          output: counts?.output,
        }),
        typeof model === "string" && model.trim() && jsx(ModelLabel, { model }),
      ],
    });
  const breakdownPanel =
    session &&
    jsx("div", {
      id: breakdownId,
      className: "ctx-ring-breakdown-body",
      hidden: !breakdownExpanded,
      children:
        breakdownExpanded &&
        (categories.length
          ? [
              jsx("div", {
                className: "ctx-ring-label ctx-ring-caption",
                children: "Estimated breakdown · tokens",
              }),
              ...categories.map((c, i) =>
                row(c.label || c.id, `~${number(c.tokens)}`, i),
              ),
            ]
          : jsx("div", {
              className: "ctx-ring-label",
              children: busy
                ? "Available after this turn."
                : query.isFetching && gateway === "open"
                  ? "Loading…"
                  : "Breakdown unavailable.",
            })),
    });
  const trigger = jsx("button", {
    type: "button",
    "data-context-tracker": "",
    className: "ctx-ring-trigger",
    "aria-label": summary,
    children: jsx("svg", {
      width: 18,
      height: 18,
      viewBox: "0 0 20 20",
      role: "meter",
      "aria-label": "Context window used",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      ...(known ? { "aria-valuenow": Number(fill.toFixed(2)) } : {}),
      "aria-valuetext": summary,
      children: [
        jsx("circle", {
          cx: 10,
          cy: 10,
          r: 7.5,
          fill: "none",
          stroke: "var(--ui-stroke-secondary)",
          strokeWidth: 2.5,
        }),
        known &&
          jsx("circle", {
            cx: 10,
            cy: 10,
            r: 7.5,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 2.5,
            pathLength: 100,
            strokeDasharray: `${fill} 100`,
            strokeLinecap: "butt",
            transform: "rotate(-90 10 10)",
          }),
        !known &&
          jsx("text", {
            x: 10,
            y: 13,
            textAnchor: "middle",
            fill: "currentColor",
            fontSize: 9,
            children: "?",
          }),
      ],
    }),
  });
  return jsx(Popover, {
    open: pinned,
    onOpenChange: (open) => setPinnedScope(open ? scope : null),
    children: [
      jsx(Tip, {
        className: "ctx-ring-tooltip",
        label: pinned ? null : contextPanel(false),
        side: "bottom",
        align: "start",
        sideOffset: 8,
        delayDuration: 200,
        children: jsx(PopoverTrigger, { asChild: true, children: trigger }),
      }),
      jsx(PopoverContent, {
        className: "ctx-ring-popover",
        "aria-label": "Context details",
        side: "bottom",
        align: "start",
        sideOffset: 8,
        children: [
          contextPanel(true),
          breakdownPanel,
          sessionPanel,
          jsx("div", {
            className: "ctx-ring-actions",
            children: [
              jsx(Button, {
                type: "button",
                size: "sm",
                variant: "outline",
                className: "ctx-ring-compact",
                disabled:
                  !session ||
                  !routed ||
                  busy ||
                  gateway !== "open" ||
                  compacting,
                onClick: compact,
                title: "Summarizes older context and may use model tokens.",
                children: compacting ? "Compacting…" : "Compact session",
              }),
              busy &&
                jsx("div", {
                  className: "ctx-ring-label",
                  children: "Available after this turn.",
                }),
              job &&
                jsx("div", {
                  role:
                    job.state === "error" || job.state === "uncertain"
                      ? "alert"
                      : "status",
                  className: "ctx-ring-feedback",
                  children: job.message,
                }),
            ],
          }),
        ],
      }),
    ],
  });
}

export default {
  id: "context-tracker",
  name: "Context tracker",
  register(ctx) {
    const style = document.createElement("style");
    style.textContent = `
.ctx-ring-context{margin-top:4px}
.ctx-ring-track{height:4px;border-radius:3px;overflow:hidden;background:var(--ui-stroke-secondary);margin:8px 0}
.ctx-ring-track>div{height:100%;border-radius:inherit;background:var(--ui-text-primary)}
.ctx-ring-counts,.ctx-ring-token-readout{color:var(--ui-text-primary);font-variant-numeric:tabular-nums}
.ctx-ring-token-readout{margin:4px 0 5px;border-radius:2px}
.ctx-ring-token-readout:focus-visible{outline:2px solid var(--ui-accent);outline-offset:3px}
.ctx-ring-token-numbers{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}
.ctx-ring-token-metric{display:inline-flex;gap:5px;align-items:baseline;white-space:nowrap}
.ctx-ring-token-metric strong{font-weight:600}
.ctx-ring-token-split{display:grid;height:5px;margin-top:5px}
.ctx-ring-token-split>i{min-width:0;overflow:hidden;border-radius:1px}
.ctx-ring-token-input{background:var(--ui-text-primary)}
.ctx-ring-token-output{--ctx-ring-hatch:var(--ui-text-secondary);background:repeating-linear-gradient(135deg,var(--ctx-ring-hatch) 0 1px,transparent 1px 3px);box-shadow:inset 0 0 0 1px var(--ctx-ring-hatch)}
.ctx-ring-info>.ctx-ring-heading{align-items:center}
.ctx-ring-heading-end{display:flex;align-items:center;gap:6px}
.ctx-ring-disclosure{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--ui-text-secondary);cursor:pointer}
.ctx-ring-disclosure:hover,.ctx-ring-disclosure[aria-expanded=true]{background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.ctx-ring-disclosure:focus-visible{outline:2px solid var(--ui-accent);outline-offset:1px}
.ctx-ring-disclosure[aria-expanded=true] svg{transform:rotate(90deg)}
.ctx-ring-breakdown-body{margin-top:8px;font-size:12px;line-height:1.5}
.ctx-ring-popover{--popover-surface:var(--ui-bg-elevated);background:var(--ui-bg-elevated);color:var(--ui-text-primary);border:1px solid var(--ui-stroke-secondary);border-radius:8px;padding:12px;width:auto;max-width:calc(100vw - 24px);max-height:var(--radix-popover-content-available-height,calc(100vh - 48px));overflow-y:auto}.ctx-ring-actions{width:244px;max-width:calc(100vw - 48px);margin-top:10px;padding-top:8px;border-top:1px solid var(--ui-stroke-secondary);font-size:12px}.ctx-ring-compact{cursor:pointer}.ctx-ring-compact:disabled{cursor:not-allowed}.ctx-ring-feedback{margin-top:8px;color:var(--ui-text-primary);overflow-wrap:anywhere}.ctx-ring-trigger[aria-expanded=true]{background:var(--ui-control-hover-background)}.ctx-ring-tooltip{--foreground:var(--ui-bg-elevated);background:var(--ui-bg-elevated);color:var(--ui-text-primary);border:1px solid var(--ui-stroke-secondary);border-radius:8px;padding:12px}.ctx-ring-trigger{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ui-text-primary);cursor:pointer;-webkit-app-region:no-drag}.ctx-ring-trigger:hover{background:var(--ui-control-hover-background)}.ctx-ring-trigger:focus-visible{outline:2px solid var(--ui-accent);outline-offset:2px}.ctx-ring-info{width:244px;max-width:calc(100vw - 48px);font-size:12px;line-height:1.5;color:var(--ui-text-primary);text-align:left;font-weight:400}.ctx-ring-heading,.ctx-ring-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}.ctx-ring-heading strong{font-size:12px;font-weight:600}.ctx-ring-section{font-size:12px;line-height:1.5}.ctx-ring-value{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ui-text-primary)}.ctx-ring-label,.ctx-ring-model,.ctx-ring-footnote{color:var(--ui-text-secondary)}.ctx-ring-model{display:flex;align-items:center;gap:5px;margin-top:2px;overflow-wrap:anywhere}.ctx-ring-model svg{flex:none}.ctx-ring-section{margin-top:10px;padding-top:8px;border-top:1px solid var(--ui-stroke-secondary)}.ctx-ring-row+.ctx-ring-row{margin-top:3px}.ctx-ring-caption{margin-bottom:5px}.ctx-ring-footnote{font-size:11px;margin-top:6px}`;
    style.textContent += `.tooltip-bubble.ctx-ring-token-tip{padding:6px 8px}`;
    document.head.append(style);
    ctx.onDispose(() => style.remove());
    ctx.register({
      id: "ring",
      area: TITLEBAR_AREAS.left,
      order: 90,
      render: () => jsx(ContextTracker, { storage: ctx.storage }),
    });
  },
};
