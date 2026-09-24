import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { AdvancementTree } from "../advancement-tree";
import { FocusTree } from "./advancement-dialog/focus-tree";
import { StandingLegend } from "./advancement-dialog/standing-legend";
import { TechTree } from "./advancement-dialog/tech-tree";

/** Which of the two trees the dialog opens on. */
type TreeTab = "focuses" | "techs";

interface AdvancementDialogProps {
  readonly nation: string;
  readonly tree: AdvancementTree;
  readonly defaultTab: TreeTab;
  /** What the button that opens the dialog says. */
  readonly trigger: string;
}

export const AdvancementDialog = ({
  defaultTab,
  nation,
  tree,
  trigger,
}: AdvancementDialogProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button className="self-start" size="sm" type="button" variant="outline">
        {trigger}
      </Button>
    </DialogTrigger>
    <DialogContent className="flex max-h-5/6 flex-col sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{nation}の国家方針と研究</DialogTitle>
        <DialogDescription asChild>
          <div>
            <StandingLegend />
          </div>
        </DialogDescription>
      </DialogHeader>
      <Tabs className="min-h-0 flex-1" defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="focuses">国家方針</TabsTrigger>
          <TabsTrigger value="techs">研究</TabsTrigger>
        </TabsList>
        <TabsContent className="min-h-0 overflow-y-auto" value="focuses">
          <FocusTree branches={tree.focuses} />
        </TabsContent>
        <TabsContent className="min-h-0 overflow-y-auto" value="techs">
          <TechTree lines={tree.techs} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
);
