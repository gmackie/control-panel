import type { Meta, StoryObj } from "@storybook/react-webpack5";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "../dropdown-menu";
import { Button } from "../button";
import { MoreVertical, Play, ScrollText, RotateCcw, Trash2, Settings } from "lucide-react";

const meta: Meta = {
  title: "Primitives/DropdownMenu",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Play className="mr-2 h-4 w-4" /> Deploy
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ScrollText className="mr-2 h-4 w-4" /> View Logs
          <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <RotateCcw className="mr-2 h-4 w-4" /> Restart
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500 focus:text-red-500">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const IconTrigger: Story = {
  name: "Icon Trigger",
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500 focus:text-red-500">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
