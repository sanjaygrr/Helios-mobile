import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Line } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface WindData {
    wind: {
        speed: number;
        deg: number;
    };
}

interface WindParticlesProps {
    weatherData: WindData | null;
}

interface Particle {
    id: number;
    x: Animated.Value;
    y: Animated.Value;
    opacity: Animated.Value;
}

export const WindParticles: React.FC<WindParticlesProps> = ({ weatherData }) => {
    const { width, height } = Dimensions.get('window');
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (!weatherData) return;

        // Create initial particles
        const particleCount = 100;
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                id: i,
                x: new Animated.Value(Math.random() * width),
                y: new Animated.Value(Math.random() * height),
                opacity: new Animated.Value(Math.random() * 0.6 + 0.2),
            });
        }

        setParticles(newParticles);

        // Animate particles
        const windRad = ((weatherData.wind.deg + 180) % 360) * (Math.PI / 180);
        const speedFactor = weatherData.wind.speed * 2;
        const vx = Math.sin(windRad) * speedFactor;
        const vy = -Math.cos(windRad) * speedFactor;

        const animations = newParticles.map((particle) => {
            const animate = () => {
                // Get current position
                const currentX = (particle.x as any)._value;
                const currentY = (particle.y as any)._value;

                // Calculate new position
                let newX = currentX + vx;
                let newY = currentY + vy;

                // Wrap around screen edges
                if (newX < 0) newX = width;
                if (newX > width) newX = 0;
                if (newY < 0) newY = height;
                if (newY > height) newY = 0;

                return Animated.parallel([
                    Animated.timing(particle.x, {
                        toValue: newX,
                        duration: 50,
                        useNativeDriver: false,
                    }),
                    Animated.timing(particle.y, {
                        toValue: newY,
                        duration: 50,
                        useNativeDriver: false,
                    }),
                    Animated.sequence([
                        Animated.timing(particle.opacity, {
                            toValue: 0.8,
                            duration: 25,
                            useNativeDriver: false,
                        }),
                        Animated.timing(particle.opacity, {
                            toValue: 0.2,
                            duration: 25,
                            useNativeDriver: false,
                        }),
                    ]),
                ]);
            };

            const loop = () => {
                animate().start(() => loop());
            };

            loop();
        });

        return () => {
            animations.forEach((anim) => {
                if (anim && anim.stop) anim.stop();
            });
        };
    }, [weatherData, width, height]);

    if (!weatherData) return null;

    // Color based on wind speed
    const getWindColor = () => {
        if (weatherData.wind.speed > 10) return '#FF0000';
        if (weatherData.wind.speed > 5) return '#FFA500';
        return '#00FF00';
    };

    const windColor = getWindColor();
    const windRad = ((weatherData.wind.deg + 180) % 360) * (Math.PI / 180);
    const lineLength = 15;

    return (
        <View style={[styles.container, { width, height }]} pointerEvents="none">
            <Svg width={width} height={height} style={styles.svg}>
                {particles.map((particle) => {
                    // Calculate line end point based on wind direction
                    const x1 = particle.x;
                    const y1 = particle.y;
                    const x2 = new Animated.Value(0);
                    const y2 = new Animated.Value(0);

                    Animated.timing(x2, {
                        toValue: (x1 as any)._value + Math.sin(windRad) * lineLength,
                        duration: 0,
                        useNativeDriver: false,
                    }).start();

                    Animated.timing(y2, {
                        toValue: (y1 as any)._value - Math.cos(windRad) * lineLength,
                        duration: 0,
                        useNativeDriver: false,
                    }).start();

                    return (
                        <AnimatedLine
                            key={particle.id}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={windColor}
                            strokeWidth="2"
                            strokeOpacity={particle.opacity}
                            strokeLinecap="round"
                        />
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    svg: {
        position: 'absolute',
    },
});
