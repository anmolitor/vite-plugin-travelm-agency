module Main exposing (..)

import Browser
import Html exposing (Html)
import Html.Events
import Http
import Json.Decode as D
import Translations exposing (I18n, Language)


type Msg
    = SwitchLanguage Language
    | LoadedTranslations (Result Http.Error (I18n -> I18n))


type alias Flags =
    D.Value


type alias Model =
    { i18n : I18n }


main : Program Flags Model Msg
main =
    Browser.document
        { init =
            \translations ->
                ( { i18n =
                        Translations.init { lang = Translations.En, path = "/i18n" }
                            |> (case D.decodeValue (Translations.decodeMessages Translations.En) translations of
                                    Ok addTranslations ->
                                        addTranslations

                                    Err err ->
                                        identity
                               )
                  }
                , Cmd.none
                )
        , update =
            \msg model ->
                case msg of
                    SwitchLanguage lang ->
                        let
                            ( i18n, cmd ) =
                                model.i18n |> Translations.switchLanguage lang LoadedTranslations
                        in
                        ( { model | i18n = i18n }, cmd )

                    LoadedTranslations (Ok addTranslations) ->
                        ( { model | i18n = addTranslations model.i18n }, Cmd.none )

                    LoadedTranslations (Err _) ->
                        ( model, Cmd.none )
        , subscriptions = \_ -> Sub.none
        , view =
            \{ i18n } ->
                { title = "Vite Plugin"
                , body =
                    [ Html.span [] [ Html.text <| Translations.testMessage i18n ]
                    ]
                        ++ List.map switchLanguageButton Translations.languages
                }
        }


switchLanguageButton : Language -> Html Msg
switchLanguageButton lang =
    Html.button [ Html.Events.onClick (SwitchLanguage lang) ] [ Html.text <| Translations.languageToString lang ]
