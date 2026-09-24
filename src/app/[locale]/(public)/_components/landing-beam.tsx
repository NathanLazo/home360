import { BeamFrame, type BeamFrameProps } from "~/components/beam";

type LandingBeamProps = Omit<BeamFrameProps, "active">;

/**
 * The landing's spectral frame: the action tint (sky → lime) traced around a
 * frame. Kept rare — the hero console, the recommended plan and the closing
 * CTA. `BeamFrame` starts still and only moves once the browser confirms
 * motion is welcome; under reduced motion it stays a still ring.
 */
export function LandingBeam(props: LandingBeamProps) {
  return <BeamFrame {...props} />;
}
