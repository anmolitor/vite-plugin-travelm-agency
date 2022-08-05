module Main exposing (..)

import Browser
import Html
import Json.Decode as D
import Translations exposing (I18n)


type Msg
    = Msg --LoadedI18n (Result Http.Error (I18n -> I18n))


type alias Flags =
    D.Value


type alias Model =
    I18n


main : Program Flags Model Msg
main =
    Browser.document
        { init =
            \translations ->
                ( Translations.init
                    |> (case D.decodeValue Translations.decodeMessages translations of
                            Ok addTranslations ->
                                addTranslations

                            Err err ->
                                identity
                       )
                , Cmd.none
                )
        , update = \_ m -> ( m, Cmd.none )
        , subscriptions = \_ -> Sub.none
        , view = \i18n -> { title = "Vite Plugin!", body = [ Html.text <| Translations.testMessage i18n ] }
        }
