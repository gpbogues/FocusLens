import { motion } from 'framer-motion';
import './Preloader.css';

interface PreloaderProps {
  greetingText: string;
}

const Preloader = ({ greetingText }: PreloaderProps) => {
  return (
    <div className="preloader-greeting-wrapper">
      <motion.h1
        className="preloader-greeting"
        layoutId="greeting-text"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
      >
        {greetingText}
      </motion.h1>
    </div>
  );
};

export default Preloader;
