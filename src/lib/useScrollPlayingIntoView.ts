import { useEffect } from 'react'

/** Scrolls the element with matching `data-instance-id` into view whenever the currently-playing
 * item changes, so playback highlighting doesn't scroll out of sight in a long board/song. */
export function useScrollPlayingIntoView(playingInstanceId: string | null) {
  useEffect(() => {
    if (!playingInstanceId) return
    document.querySelector(`[data-instance-id="${playingInstanceId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [playingInstanceId])
}
