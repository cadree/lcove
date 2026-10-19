import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FirstRunAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface FirstRunEmptyProps {
  title: string;
  description: string;
  actions: FirstRunAction[];
}

const FirstRunEmpty = ({ title, description, actions }: FirstRunEmptyProps) => {
  return (
    <div className="glass-strong rounded-2xl px-6 py-10 text-center">
      <h3 className="font-display text-xl text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{description}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {actions.map((action, index) =>
          action.to ? (
            <Button key={action.label} variant={index === 0 ? "default" : "outline"} asChild>
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ) : (
            <Button
              key={action.label}
              variant={index === 0 ? "default" : "outline"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
};

export default FirstRunEmpty;
