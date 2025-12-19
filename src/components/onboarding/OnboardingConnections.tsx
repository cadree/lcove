import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Music, Store, Crown, ChevronLeft } from 'lucide-react';

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

interface ConnectionOption {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  route: string;
}

const options: ConnectionOption[] = [
  {
    id: 'music',
    icon: Music,
    title: 'Connect Music Profile',
    description: 'Link your Spotify or Apple Music to showcase your catalog',
    color: 'from-green-500/20 to-green-600/10',
    route: '/profile',
  },
  {
    id: 'store',
    icon: Store,
    title: 'Set Up Your Store',
    description: 'Sell products, offer services, or list studio rentals',
    color: 'from-primary/20 to-primary/10',
    route: '/store',
  },
  {
    id: 'membership',
    icon: Crown,
    title: 'Become a Member',
    description: 'Support the community and unlock exclusive benefits',
    color: 'from-amber-500/20 to-amber-600/10',
    route: '/membership',
  },
];

const OnboardingConnections = ({ onComplete, onBack }: Props) => {
  const navigate = useNavigate();

  const handleOptionClick = (route: string) => {
    // Navigate to the target page - onboarding is already complete at this point
    navigate(route);
  };

  const handleSkip = () => {
    // Navigate to feed/home - onboarding is already complete
    navigate('/feed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="font-display text-4xl md:text-5xl text-gradient-pink mb-3">
            One more thing...
          </h1>
          <p className="text-muted-foreground text-lg">
            Optional ways to enhance your presence in the community
          </p>
        </motion.div>

        {/* Options */}
        <div className="space-y-4 mb-8">
          {options.map((option, index) => (
            <motion.button
              key={option.id}
              onClick={() => handleOptionClick(option.route)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="block w-full text-left"
            >
              <div className={`glass-strong rounded-2xl p-5 hover:bg-accent/20 transition-all group cursor-pointer bg-gradient-to-r ${option.color}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-background/50 flex items-center justify-center">
                    <option.icon className="w-7 h-7 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-lg mb-1">
                      {option.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Skip / Continue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between"
        >
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleSkip} className="glow-pink">
            Skip for now
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingConnections;
