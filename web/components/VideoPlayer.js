import styles from "../styles/VideoPlayer.module.css";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import {
  PlayIcon,
  PauseIcon,
  ChatBubbleOvalLeftIcon,
} from "@heroicons/react/24/solid";

import {
  handleMouseMovement,
  noAudio,
  handleFullscreen,
  formatTime,
  seek,
  togglePlay,
  updateProgress,
  updateVolume,
} from "../functions/video";
import {
  handlePause,
  handlePlay,
  handleSeeked,
  loadStartPosition,
} from "../functions/watchparty";

const VideoPlayer = ({
  autoplay,
  src,
  name,
  controls,
  partyId,
  creatorId,
  ws,
  playheadStart,
  screenRef,
  unreadIndicator,
  setUnreadIndicator,
  showSidebar,
  setShowSidebar,
  onEndParty,
}) => {
  const videoRef = useRef();
  const progressRef = useRef();
  const containerRef = useRef();
  const volumeRef = useRef();
  const controlsRef = useRef();
  const subtitleBtnRef = useRef();

  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState();
  const [duration, setDuration] = useState();
  const [audio, setAudio] = useState(true);
  const [isPaused, setIsPaused] = useState(true);
  const [subtitleURL, setSubtitleURL] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoError, setVideoError] = useState(null);

  const videoSrc = typeof src === "string" ? src : "";

  const getVideoType = () => {
    if (!videoSrc) return undefined;
    try {
      const url = new URL(videoSrc);
      const pathname = url.pathname.toLowerCase();
      if (pathname.endsWith(".mp4")) return "video/mp4";
      if (pathname.endsWith(".webm")) return "video/webm";
      if (pathname.endsWith(".ogg") || pathname.endsWith(".ogv")) return "video/ogg";
      return undefined;
    } catch {
      const lower = videoSrc.toLowerCase();
      if (lower.includes(".mp4")) return "video/mp4";
      if (lower.includes(".webm")) return "video/webm";
      if (lower.includes(".ogg") || lower.includes(".ogv")) return "video/ogg";
      return undefined;
    }
  };

  const setStyle = () => {
    if (!containerRef.current || !videoRef.current) return;
    const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect()
    const { width: videoWidth, height: videoHeight } = videoRef.current.getBoundingClientRect()
    const containerAspectRatio = containerWidth / containerHeight
    const videoAspectRatio = videoWidth / videoHeight
    console.log({ containerAspectRatio, videoAspectRatio })

  }

  const getSubtitleSrc = () => {
    if (!videoSrc) return "";
    const subsArr = videoSrc.split(".");
    subsArr.splice(-1, 1, "vtt");
    const subtitleURL = subsArr.join(".");
    return subtitleURL;
  };

  const hideSubtitles = () => {
    if (!videoRef.current?.textTracks?.[0]) return;
    videoRef.current.textTracks[0].mode = "hidden";
  };

  const toggleSubtitles = () => {
    if (!videoRef.current?.textTracks?.[0]) return;
    if (videoRef.current.textTracks[0].mode === "hidden") {
      videoRef.current.textTracks[0].mode = "showing";
      subtitleBtnRef.current.setAttribute("data-state", "active");
    } else {
      videoRef.current.textTracks[0].mode = "hidden";
      subtitleBtnRef.current.setAttribute("data-state", "hidden");
    }
  };

  // Ensure video does not get cropped
  // Video gets expanded to max height or width depending on video and container
  // aspect ratio
  useEffect(() => {
    if (!videoRef.current || !containerRef.current) return;

    const ro = new ResizeObserver(entries => {
      if (!containerRef.current || !videoRef.current) return;

      const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect()
      const { width: videoWidth, height: videoHeight } = videoRef.current.getBoundingClientRect()
      const containerAspectRatio = containerWidth / containerHeight
      const videoAspectRatio = videoWidth / videoHeight
      console.log({ containerAspectRatio, videoAspectRatio })
      if (containerAspectRatio > videoAspectRatio) {
        videoRef.current.classList.remove("full-width")
        videoRef.current.classList.add("full-height")
      } else {
        videoRef.current.classList.add("full-width")
        videoRef.current.classList.remove("full-height")
      }
    })
    ro.observe(containerRef.current)

    return () => {
      if (containerRef.current) {
        ro.unobserve(containerRef.current);
      }
    }
  }, [videoRef, containerRef])

  useEffect(() => {
    if (!videoRef.current) return;
    setTime(formatTime(videoRef.current.currentTime));
    hideSubtitles();
    setSubtitleURL(getSubtitleSrc());
  }, [videoSrc]);

  return (
    <div
      ref={containerRef}
      onMouseMove={() =>
        handleMouseMovement(containerRef.current, controlsRef.current)
      }
      id="video-player"
      className={styles.player}
    >
      <video
        id="video"
        preload="auto"
        onLoadStart={() => {
          setVideoError(null);
        }}
        onPlay={() => {
          setIsPaused(videoRef.current.paused);
          setIsBuffering(false);
          if (controls) {
            handlePlay(partyId, creatorId, ws);
          }
        }}
        onPause={() => {
          setIsPaused(videoRef.current.paused);
          if (controls) {
            handlePause(partyId, creatorId, ws);
          }
        }}
        onSeeked={() => {
          setIsBuffering(false);
          if (controls) {
            handleSeeked(partyId, creatorId, ws);
          }
        }}
        onSeeking={() => {
          setIsBuffering(true);
        }}
        onWaiting={() => {
          setIsBuffering(true);
        }}
        onCanPlay={() => {
          setIsBuffering(false);
        }}
        onStalled={() => {
          console.log('Video stalled - attempting recovery');
          setIsBuffering(true);
          // Attempt recovery by nudging playhead
          if (videoRef.current && !videoRef.current.paused) {
            const currentTime = videoRef.current.currentTime;
            videoRef.current.currentTime = currentTime + 0.1;
          }
        }}
        onError={(e) => {
          console.error('Video error:', e);
          setIsBuffering(false);
          setVideoError('Video failed to load. The URL may be invalid, blocked by CORS, or the format is unsupported by the browser.');
        }}
        onTimeUpdate={() =>
          updateProgress(videoRef.current, progressRef.current, setTime)
        }
        onLoadedMetadata={() => {
          loadStartPosition(playheadStart);
          setDuration(formatTime(videoRef.current.duration));
          setStyle();
          hideSubtitles();
        }}
        ref={videoRef}
        className={styles.viewer}
        autoPlay={autoplay}
      >
        {videoSrc ? (
          <source src={videoSrc} type={getVideoType()} />
        ) : null}
        <track
          label="English"
          kind="subtitles"
          srcLang="en"
          src={subtitleURL}
          default
        />
      </video>

      {(!videoSrc || videoError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 p-4">
          <div className="max-w-xl text-center">
            <p className="text-sm text-white">
              {videoError || 'Video source is missing.'}
            </p>
            {videoSrc ? (
              <p className="mt-2 text-xs text-neutral-300 break-all">{videoSrc}</p>
            ) : null}
          </div>
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}

      <div className="" ref={controlsRef}>
        <div
          className="absolute inset-x-0 top-16"
        >
          <p style={{ fontSize: "24px" }} className="text-2xl text-white drop-shadow-md">
            {name}
          </p>
        </div>
        <div
          className="absolute flex justify-center items-center top-0 bottom-0 left-0 right-0"
          onClick={() => {
            if (controls) {
              togglePlay(videoRef.current);
            }
          }}
        >
          {isPaused ? (
            <PlayIcon className="h-20 w-20 text-white" />
          ) : controls ? (
            <PauseIcon className="h-20 w-20 text-white" />
          ) : null}
        </div>
        <div
          onClick={(e) => {
            controls ? seek(e, videoRef.current) : null;
          }}
          className={styles.progress}
        >
          <div ref={progressRef} className={styles.progressFilled} />
        </div>
        {controls && (
          <div
            className="absolute bottom-4 left-3"
            onClick={() => togglePlay(videoRef.current)}
          >
            {isPaused ? (
              <PlayIcon className="h-6 w-6 text-white" />
            ) : (
              <PauseIcon className="h-6 w-6 text-white" />
            )}
          </div>
        )}
        {time && duration && (
          <p>
            {time} / {duration}
          </p>
        )}
        <div className={styles.audio}>
          <Image
            src={audio ? "/audio.png" : "/no-audio.png"}
            onClick={() =>
              noAudio(videoRef.current, setAudio, setVolume, volumeRef.current)
            }
            width={24}
            height={24}
            alt="audio icon"
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          ref={volumeRef}
          name="volume"
          className={styles.slider}
          onChange={(e) =>
            updateVolume(e, videoRef.current, setVolume, setAudio)
          }
        />
        <button
          ref={subtitleBtnRef}
          data-state="hidden"
          onClick={toggleSubtitles}
          className={styles.subtitle}
        >
          CC
        </button>

        <div className={styles.fullscreen}>
          <Image
            src="/fullscreen.png"
            onClick={() => handleFullscreen(screenRef.current)}
            alt="fullscreen icon"
            width={24}
            height={24}
          />
        </div>
        {controls && onEndParty && (
          <button
            onClick={onEndParty}
            className={styles.endPartyButton}>
            End watchparty
          </button>
        )}
      </div>
      <button
        onClick={() => {
          if (!showSidebar) {
            setUnreadIndicator(false);
            setShowSidebar(true);
          } else {
            setShowSidebar(false);
          }
        }}
        className="absolute top-4 right-4"
      >
        {!showSidebar ? (
          unreadIndicator ? (
            <ChatBubbleOvalLeftIcon
              className="text-green-400 hover:text-green-300"
              width={35}
            />
          ) : (
            <ChatBubbleOvalLeftIcon
              className="text-neutral-700 hover:text-neutral-500 duration-150 drop-shadow-xl"
              width={30}
            />
          )
        ) : (
          <></>
        )}
      </button>
    </div>
  );
};

export default VideoPlayer;
