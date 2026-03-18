import type { Preview } from "@storybook/react-webpack5";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#141316" },
        { name: "light", value: "#F8F7FA" },
      ],
    },
  },
  decorators: [
    (Story) => {
      // Ensure dark class is on the html element for Storybook
      document.documentElement.classList.add("dark");
      return Story();
    },
  ],
};

export default preview;
