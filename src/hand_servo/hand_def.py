def handOpen(lm):
    fingers_open = (
        lm[8].y  < lm[5].y and
        lm[12].y < lm[9].y and
        lm[16].y < lm[13].y and
        lm[20].y < lm[17].y
    )
    # lòng bàn tay gần thẳng đứng
    palm_upright = abs(lm[5].x - lm[17].x) < 0.15

    return fingers_open and palm_upright


def handClose(lm):
    index_closed  = lm[8].y  > lm[5].y
    middle_closed = lm[12].y > lm[9].y
    ring_closed   = lm[16].y > lm[13].y
    pinky_closed  = lm[20].y > lm[17].y
    return index_closed and middle_closed and ring_closed and pinky_closed

def thumb_extended(lm):
    # khoảng cách tip (4) tới gốc bàn tay (0)
    d_tip = abs(lm[4].x - lm[0].x)
    d_ip  = abs(lm[3].x - lm[0].x)
    return d_tip > d_ip + 0.02

def upHand(lm):
    index_up = lm[8].y < lm[6].y

    other_down = (
        lm[12].y > lm[10].y and
        lm[16].y > lm[14].y and
        lm[20].y > lm[18].y
    )

    index_above_wrist = lm[8].y < lm[0].y - 0.05

    thumb_not_extended = not thumb_extended(lm)

    return index_up and other_down and index_above_wrist and thumb_not_extended


def downHand(lm):
    index_down = lm[8].y < lm[6].y

    other_down = (
        lm[12].y > lm[10].y and
        lm[16].y > lm[14].y and
        lm[20].y > lm[18].y
    )

    index_below_wrist = lm[8].y < lm[0].y - 0.05

    thumb_is_extended = thumb_extended(lm)

    return index_down and other_down and index_below_wrist and thumb_is_extended

