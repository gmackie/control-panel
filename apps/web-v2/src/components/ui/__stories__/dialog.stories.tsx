import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../dialog";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";

const meta: Meta = {
  title: "Primitives/Dialog",
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogClose onClick={() => setOpen(false)} />
            <DialogHeader>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update the application configuration. Click save when done.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue="control-panel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo">Repository URL</Label>
                <Input id="repo" defaultValue="https://git.gmac.io/gmac/control-panel" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

export const Destructive: Story = {
  name: "Destructive Confirmation",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete Application
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogClose onClick={() => setOpen(false)} />
            <DialogHeader>
              <DialogTitle>Delete api-gateway?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the
                application and remove all associated deployments.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setOpen(false)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};
