"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Edit,
  Trash2,
  FastForward,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Training, Exercise } from "@/lib/types";
import { formatTime } from "@/lib/utils";

// Dynamically import react-confetti to avoid SSR issues
const ReactConfetti = dynamic(() => import("react-confetti"), {
  ssr: false,
});

interface TrainingViewProps {
  training: Training;
  onEdit: () => void;
  onDelete: () => void;
  allExercises: Exercise[];
}

// Helper type for the expanded exercise sequence that includes rest periods
interface SequenceItem {
  id: string;
  name: string;
  duration: number;
  isRest: boolean;
  originalIndex?: number;
}

export default function TrainingView({
  training,
  onEdit,
  onDelete,
  allExercises,
}: TrainingViewProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [exerciseSequence, setExerciseSequence] = useState<SequenceItem[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const windowSizeRef = useRef({ width: 0, height: 0 });

  // Add window size effect for confetti
  useEffect(() => {
    const updateWindowSize = () => {
      windowSizeRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };

    updateWindowSize();
    window.addEventListener("resize", updateWindowSize);
    return () => window.removeEventListener("resize", updateWindowSize);
  }, []);

  // Create the exercise sequence with rest periods
  useEffect(() => {
    if (training && training.exercises.length > 0) {
      const sequence: SequenceItem[] = [];
      let totalDuration = 0;

      training.exercises.forEach((ex, index) => {
        const exercise = allExercises.find((e) => e.id === ex.exerciseId);

        if (exercise) {
          // Add the exercise
          sequence.push({
            id: ex.id,
            name: exercise.name,
            duration: ex.duration,
            isRest: exercise.isRest,
            originalIndex: index,
          });
          totalDuration += ex.duration;

          // Add rest period after each exercise except the last one
          if (index < training.exercises.length - 1 && training.restTime > 0) {
            sequence.push({
              id: `rest-${index}`,
              name: "Rest",
              duration: training.restTime,
              isRest: true,
            });
            totalDuration += training.restTime;
          }
        }
      });

      setExerciseSequence(sequence);
      setTotalTime(totalDuration);

      if (sequence.length > 0) {
        setTimeRemaining(sequence[0].duration);
      }
    }

    // Reset state
    setIsRunning(false);
    setCurrentExerciseIndex(0);
    setElapsedTime(0);

    // Create audio element
    audioRef.current = new Audio("/beep.mp3");

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [training, allExercises]);

  const getCurrentExercise = () => {
    if (!exerciseSequence || currentExerciseIndex >= exerciseSequence.length) {
      return null;
    }

    return exerciseSequence[currentExerciseIndex];
  };

  const handleStart = () => {
    if (!exerciseSequence || exerciseSequence.length === 0) return;

    setIsRunning(true);
    audioRef.current?.play();

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        console.log(prev);
        return prev + 1;
      });
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          const nextIndex = currentExerciseIndex + 1;

          if (nextIndex >= exerciseSequence.length) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            setCurrentExerciseIndex(nextIndex);
            setShowConfetti(true);
            audioRef.current = new Audio("/win.mp3");
            audioRef.current?.play();
            audioRef.current = new Audio("/beep.mp3");
            // Hide confetti after 5 seconds
            setTimeout(() => setShowConfetti(false), 5000);
            return 0;
          } else {
            // Move to next exercise
            setCurrentExerciseIndex(nextIndex);
            audioRef.current?.play();
            return exerciseSequence[nextIndex].duration;
          }
        }

        return prev - 1;
      });
    }, 1000);
  };

  const handlePause = () => {
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentExerciseIndex(0);
    setElapsedTime(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (exerciseSequence && exerciseSequence.length > 0) {
      setTimeRemaining(exerciseSequence[0].duration);
    }
  };

  const handleSkip = () => {
    if (exerciseSequence && exerciseSequence.length > 0) {
      setCurrentExerciseIndex((prev) => prev + 1);
      if (currentExerciseIndex < exerciseSequence.length) {
        setTimeRemaining(exerciseSequence[currentExerciseIndex + 1].duration);
      } else {
        setTimeRemaining(0);
        clearInterval(timerRef.current!);
        setIsRunning(false);
      }
    }
  };

  const currentExercise = getCurrentExercise();
  const progress = totalTime > 0 ? (elapsedTime / totalTime) * 100 : 0;
  const isComplete = currentExerciseIndex >= exerciseSequence.length;

  return (
    <div className="max-w-3xl mx-auto">
      {showConfetti && (
        <ReactConfetti
          width={windowSizeRef.current.width}
          height={windowSizeRef.current.height}
          recycle={false}
          numberOfPieces={200}
        />
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{training.name}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
              <span className="sr-only">Редагувати</span>
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Видалити</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Прогрес</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="bg-muted p-6 rounded-lg text-center">
            {isComplete ? (
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Тренування завершено!</h3>
                <p className="text-muted-foreground">
                  Чудова робота! Ви завершили своє тренування.
                </p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-2">
                  {currentExercise?.name || "No exercise"}
                </h3>
                <div className="text-5xl font-mono my-6">
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-muted-foreground">
                  {currentExercise?.isRest
                    ? "Час відпочинку"
                    : `Вправа ${(currentExercise?.originalIndex ?? 0) + 1} з ${
                        training.exercises.length
                      }`}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exerciseSequence.map((ex, index) => (
              <div
                key={ex.id}
                className={`p-3 rounded-md border text-center ${
                  index === currentExerciseIndex
                    ? "bg-primary/10 border-primary"
                    : index < currentExerciseIndex
                    ? "bg-muted/50 border-muted"
                    : ""
                } ${ex.isRest ? "bg-muted/30" : ""}`}
              >
                <div className="font-medium truncate">{ex.name}</div>
                <div className="text-sm text-muted-foreground">
                  {ex.duration}s
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          {isRunning ? (
            <Button size="lg" variant="outline" onClick={handlePause}>
              <Pause className="mr-2 h-5 w-5" />
              Пауза
            </Button>
          ) : (
            <Button size="lg" onClick={handleStart} disabled={isComplete}>
              <Play className="mr-2 h-5 w-5" />
              {currentExerciseIndex === 0 &&
              timeRemaining === exerciseSequence[0]?.duration
                ? "Старт"
                : "Продовжити"}
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-5 w-5" />
            Скинути
          </Button>
          <Button size="lg" variant="outline" onClick={handleSkip}>
            <FastForward className="mr-2 h-5 w-5" />
            Пропустити
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
